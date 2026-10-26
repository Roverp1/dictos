import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StorageError, type LocalStateRepository } from "@dictos/core";
import * as errore from "@dictos/errore";

import { FsLocalStateRepository } from "./fs-local-state-repository";

async function fixture(cleanup: errore.AsyncDisposableStack) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-state-"));
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  return {
    directory,
    file: path.join(directory, "local-state.json"),
    repository: new FsLocalStateRepository(directory) as LocalStateRepository,
  };
}

describe("FsLocalStateRepository", () => {
  test("ignores legacy Selected Model state without changing identity or rewriting the file", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { file, repository } = await fixture(cleanup);
    const raw =
      '{ "deviceId": "existing-device", "selectedModel": {"providerId":"openai"} }\n';
    await fs.writeFile(file, raw);
    const before = await fs.stat(file);

    expect(await repository.getLocalState()).toEqual({
      deviceId: "existing-device",
    });
    expect(await fs.readFile(file, "utf8")).toBe(raw);
    const after = await fs.stat(file);
    expect(after.ino).toBe(before.ino);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  test("initializes missing device identity once", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const first = await repository.getLocalState();
    if (first instanceof Error) throw first;
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    const second = await new FsLocalStateRepository(directory).getLocalState();
    expect(second).toEqual(first);
  });

  test("keeps the device ID from an existing device-only file", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { file, repository } = await fixture(cleanup);
    await fs.writeFile(file, JSON.stringify({ deviceId: "existing-device" }));
    expect(await repository.getLocalState()).toEqual({
      deviceId: "existing-device",
    });
  });

  test("returns StorageError for malformed state without replacing it", async () => {
    for (const raw of [
      '{"deviceId":',
      "{}",
      '{"deviceId":""}',
      '{"deviceId":42}',
      "null",
    ]) {
      await using cleanup = new errore.AsyncDisposableStack();
      const { file, repository } = await fixture(cleanup);
      await fs.writeFile(file, raw);
      expect(await repository.getLocalState()).toBeInstanceOf(StorageError);
      expect(await fs.readFile(file, "utf8")).toBe(raw);
    }
  });

  test("explicit reset replaces the device identity", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    const reset = await repository.resetLocalState();
    if (reset instanceof Error) throw reset;
    expect(reset.deviceId).not.toBe(initial.deviceId);
    expect(await repository.getLocalState()).toEqual(reset);
  });

  test("failed reset leaves the existing identity intact", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file, repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    // A directory at the replacement path forces the rename to fail without mocking I/O.
    await fs.rename(file, path.join(directory, "saved-state.json"));
    await fs.mkdir(file);
    expect(await repository.resetLocalState()).toBeInstanceOf(StorageError);
    expect(
      JSON.parse(
        await fs.readFile(path.join(directory, "saved-state.json"), "utf8")
      )
    ).toEqual(initial);
  });

  test("parallel repository instances do not replace an initialized device ID", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory } = await fixture(cleanup);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        new FsLocalStateRepository(directory).getLocalState()
      )
    );
    for (const result of results) {
      if (result instanceof Error) throw result;
      expect(result.deviceId).toBe(
        (results[0] as { deviceId: string }).deviceId
      );
    }
  });

  test("separate CLI processes initialize the same identity", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const moduleUrl = new URL("./fs-local-state-repository.ts", import.meta.url)
      .href;
    const script = `import { FsLocalStateRepository } from ${JSON.stringify(moduleUrl)}; const state = await new FsLocalStateRepository(process.argv[1]).getLocalState(); if (state instanceof Error) process.exit(1); console.log(JSON.stringify(state));`;
    const children = Array.from({ length: 6 }, () =>
      Bun.spawn(["bun", "-e", script, directory], {
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
    const saved = await repository.getLocalState();
    if (saved instanceof Error) throw saved;
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(JSON.parse(result.output)).toEqual(saved);
    }
  });

  test("lock contention times out without losing identity", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    await fs.mkdir(path.join(directory, "local-state.json.lock"));
    expect(await repository.getLocalState()).toBeInstanceOf(StorageError);
    await fs.rmdir(path.join(directory, "local-state.json.lock"));
    expect(await repository.getLocalState()).toEqual(initial);
  });
});
