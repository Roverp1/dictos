import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as errore from "@dictos/errore";
import { StorageError } from "@dictos/core";

import type {
  OverlayCaptureLocalState,
  OverlayCaptureStateStore,
} from "../overlay-capture-state";
import { FsOverlayCaptureStateRepository } from "./fs-overlay-capture-state-repository";

async function fixture(cleanup: errore.AsyncDisposableStack) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-overlay-"));
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  return {
    directory,
    file: path.join(directory, "overlay-capture", "state.json"),
    repository: new FsOverlayCaptureStateRepository(
      directory
    ) as OverlayCaptureStateStore,
  };
}

describe("FsOverlayCaptureStateRepository", () => {
  test("an abandoned legacy lock does not prevent replacing the snapshot", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file } = await fixture(cleanup);
    await fs.mkdir(path.join(path.dirname(file), "state.json.lock"), {
      recursive: true,
    });
    const repository: OverlayCaptureStateStore =
      new FsOverlayCaptureStateRepository(directory);
    const snapshot: OverlayCaptureLocalState = {
      version: 1,
      instructionText: "Recovered Instruction",
      selectedTypes: ["example"],
    };
    expect(await repository.replace(snapshot)).toEqual(snapshot);
    expect(await repository.read()).toEqual(snapshot);
  });

  test("missing state reads as an empty Instruction and default Description Type", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { file, repository } = await fixture(cleanup);
    expect(await repository.read()).toEqual({
      version: 1,
      instructionText: "",
      selectedTypes: ["definition"],
    });
    expect(await fs.stat(file).catch((error: unknown) => error)).toHaveProperty(
      "code",
      "ENOENT"
    );
  });

  test("one instance persists queued snapshots in call order", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { repository } = await fixture(cleanup);
    const snapshots: OverlayCaptureLocalState[] = Array.from(
      { length: 20 },
      (_, i) => ({
        version: 1,
        instructionText: `Instruction ${i}`,
        selectedTypes: i % 2 ? ["example"] : ["definition"],
      })
    );
    const results = await Promise.all(
      snapshots.map((snapshot) => repository.replace(snapshot))
    );
    expect(results).toEqual(snapshots);
    expect(await repository.read()).toEqual({
      version: 1,
      instructionText: "Instruction 19",
      selectedTypes: ["example"],
    });
  });

  test("a failed queued write does not block the next valid snapshot", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { file, repository } = await fixture(cleanup);
    await fs.mkdir(path.dirname(file));
    await fs.writeFile(file, "corrupt");
    const snapshot: OverlayCaptureLocalState = {
      version: 1,
      instructionText: "Recovered Instruction",
      selectedTypes: ["misc"],
    };
    expect(await repository.replace(snapshot)).toBeInstanceOf(StorageError);
    await fs.rm(file);
    expect(await repository.replace(snapshot)).toEqual(snapshot);
    expect(await repository.read()).toEqual(snapshot);
    expect(await fs.readdir(path.dirname(file))).toEqual(["state.json"]);
  });

  test("replace persists only the overlay fields and clears an Instruction explicitly", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file, repository } = await fixture(cleanup);
    const first = await repository.replace({
      version: 1,
      instructionText: "Keep this exact Instruction\n",
      selectedTypes: ["example", "translation"],
    });
    if (first instanceof Error) throw first;
    expect(await new FsOverlayCaptureStateRepository(directory).read()).toEqual(
      first
    );

    const cleared = await repository.replace({
      version: 1,
      instructionText: "",
      selectedTypes: [],
      extra: "should not be stored",
    } as Parameters<OverlayCaptureStateStore["replace"]>[0]);
    if (cleared instanceof Error) throw cleared;
    expect(await repository.read()).toEqual({
      version: 1,
      instructionText: "",
      selectedTypes: [],
    });
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual({
      version: 1,
      instructionText: "",
      selectedTypes: [],
    });
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(path.dirname(file))).mode & 0o777).toBe(0o700);
  });

  test("malformed state is reported and never overwritten", async () => {
    for (const raw of [
      '{"version":1,"instructionText":"private',
      '{"version":2,"instructionText":"private","selectedTypes":["definition"]}',
      '{"version":1,"instructionText":"private","selectedTypes":["invalid"]}',
      '{"version":1,"instructionText":null,"selectedTypes":["definition"]}',
    ]) {
      await using cleanup = new errore.AsyncDisposableStack();
      const { file, repository } = await fixture(cleanup);
      await fs.mkdir(path.dirname(file));
      await fs.writeFile(file, raw);
      expect(await repository.read()).toBeInstanceOf(StorageError);
      expect(
        await repository.replace({
          version: 1,
          instructionText: "new",
          selectedTypes: ["misc"],
        })
      ).toBeInstanceOf(StorageError);
      expect(await fs.readFile(file, "utf8")).toBe(raw);
    }
  });

  test("invalid Description Types cannot replace saved state", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { repository } = await fixture(cleanup);
    const saved = {
      version: 1 as const,
      instructionText: "private",
      selectedTypes: ["definition" as const],
    };
    const first = await repository.replace(saved);
    if (first instanceof Error) throw first;
    expect(
      await repository.replace({
        ...saved,
        selectedTypes: ["bogus"],
      } as unknown as typeof saved)
    ).toBeInstanceOf(StorageError);
    expect(await repository.read()).toEqual(saved);
  });

  test("failed replacement returns StorageError and keeps saved state", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file, repository } = await fixture(cleanup);
    const saved = {
      version: 1 as const,
      instructionText: "private",
      selectedTypes: ["definition" as const],
    };
    const first = await repository.replace(saved);
    if (first instanceof Error) throw first;
    const backup = path.join(directory, "saved-state.json");
    await fs.rename(file, backup);
    await fs.mkdir(file);
    expect(
      await repository.replace({ ...saved, instructionText: "changed" })
    ).toBeInstanceOf(StorageError);
    expect(JSON.parse(await fs.readFile(backup, "utf8"))).toEqual(saved);
    expect(await fs.readdir(path.dirname(file))).toEqual(["state.json"]);
  });

  test("a blocked state directory returns StorageError without touching other local state", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const localState = path.join(directory, "local-state.json");
    await fs.writeFile(localState, "device data");
    await fs.writeFile(path.join(directory, "overlay-capture"), "blocked");
    expect(
      await repository.replace({
        version: 1,
        instructionText: "private",
        selectedTypes: ["definition"],
      })
    ).toBeInstanceOf(StorageError);
    expect(await fs.readFile(localState, "utf8")).toBe("device data");
  });

  test("concurrent instances replace whole states without exposing partial JSON", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file, repository } = await fixture(cleanup);
    const states: OverlayCaptureLocalState[] = Array.from(
      { length: 12 },
      (_, i) => ({
        version: 1 as const,
        instructionText: `Instruction ${i}`,
        selectedTypes:
          i % 2
            ? ["example" as const]
            : ["translation" as const, "misc" as const],
      })
    );
    const results = await Promise.all(
      states.map((state) =>
        new FsOverlayCaptureStateRepository(directory).replace(state)
      )
    );
    for (const result of results) {
      if (result instanceof Error) throw result;
      expect(states).toContainEqual(result);
    }
    const saved = await repository.read();
    if (saved instanceof Error) throw saved;
    expect(states).toContainEqual(saved);
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual(saved);
  });

  test("concurrent processes write complete overlay states", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const moduleUrl = new URL(
      "./fs-overlay-capture-state-repository.ts",
      import.meta.url
    ).href;
    const script = `import { FsOverlayCaptureStateRepository } from ${JSON.stringify(moduleUrl)}; const state = await new FsOverlayCaptureStateRepository(process.argv[1]).replace({version:1,instructionText:process.argv[2],selectedTypes:['example']}); if (state instanceof Error) process.exit(1); console.log(JSON.stringify(state));`;
    const children = Array.from({ length: 5 }, (_, i) =>
      Bun.spawn(["bun", "-e", script, directory, `Instruction ${i}`], {
        stdout: "pipe",
        stderr: "pipe",
      })
    );
    const results = await Promise.all(
      children.map(async (child) => ({
        code: await child.exited,
        output: await new Response(child.stdout).text(),
      }))
    );
    for (const result of results) expect(result.code).toBe(0);
    const saved = await repository.read();
    if (saved instanceof Error) throw saved;
    expect(results.map((result) => JSON.parse(result.output))).toContainEqual(
      saved
    );
  });
});
