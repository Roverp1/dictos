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
  test("initializes missing state once with no Selected Model", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const first = await repository.getLocalState();
    if (first instanceof Error) throw first;
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.selectedModel).toBeNull();
    const second = await new FsLocalStateRepository(directory).getLocalState();
    expect(second).toEqual(first);
  });

  test("keeps the device ID from an existing device-only file", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { file, repository } = await fixture(cleanup);
    await fs.writeFile(file, JSON.stringify({ deviceId: "existing-device" }));
    expect(await repository.getLocalState()).toEqual({
      deviceId: "existing-device",
      selectedModel: null,
    });
  });

  test("returns StorageError for malformed state without replacing it", async () => {
    for (const raw of [
      '{"deviceId":',
      "{}",
      '{"deviceId":"ok","selectedModel":{"providerId":"openai"}}',
    ]) {
      await using cleanup = new errore.AsyncDisposableStack();
      const { file, repository } = await fixture(cleanup);
      await fs.writeFile(file, raw);
      expect(await repository.getLocalState()).toBeInstanceOf(StorageError);
      expect(await repository.setSelectedModel(null)).toBeInstanceOf(
        StorageError
      );
      expect(await fs.readFile(file, "utf8")).toBe(raw);
    }
  });

  test("selection updates preserve identity and explicit reset changes it", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    const selected = await repository.setSelectedModel({
      providerId: "openai",
      modelId: "gpt-4o",
    });
    expect(selected).toEqual({
      deviceId: initial.deviceId,
      selectedModel: { providerId: "openai", modelId: "gpt-4o" },
    });
    expect(await repository.getLocalState()).toEqual(selected);
    const reset = await repository.resetLocalState();
    if (reset instanceof Error) throw reset;
    expect(reset.deviceId).not.toBe(initial.deviceId);
    expect(reset.selectedModel).toBeNull();
    expect(await repository.getLocalState()).toEqual(reset);
  });

  test("failed replacement leaves the existing identity and selection intact", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file, repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    // A directory at the replacement path forces the rename to fail without mocking I/O.
    await fs.rename(file, path.join(directory, "saved-state.json"));
    await fs.mkdir(file);
    expect(
      await repository.setSelectedModel({
        providerId: "openai",
        modelId: "gpt-4o",
      })
    ).toBeInstanceOf(StorageError);
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

  test("concurrent CLI selection updates never change the device ID or expose partial JSON", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, file, repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    const moduleUrl = new URL("./fs-local-state-repository.ts", import.meta.url)
      .href;
    const script = `import { FsLocalStateRepository } from ${JSON.stringify(moduleUrl)}; const state = await new FsLocalStateRepository(process.argv[1]).setSelectedModel({providerId:'openai',modelId:process.argv[2]}); if (state instanceof Error) process.exit(1); console.log(JSON.stringify(state));`;
    const children = Array.from({ length: 6 }, (_, index) =>
      Bun.spawn(["bun", "-e", script, directory, `model-${index}`], {
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
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(JSON.parse(result.output).deviceId).toBe(initial.deviceId);
    }
    const saved = await repository.getLocalState();
    if (saved instanceof Error) throw saved;
    expect(saved.deviceId).toBe(initial.deviceId);
    expect(
      results.map((result) => JSON.parse(result.output).selectedModel)
    ).toContainEqual(saved.selectedModel);
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual(saved);
  });

  test("lock contention times out without losing identity", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    await fs.mkdir(path.join(directory, "local-state.json.lock"));
    expect(
      await repository.setSelectedModel({
        providerId: "openai",
        modelId: "gpt-4o",
      })
    ).toBeInstanceOf(StorageError);
    await fs.rmdir(path.join(directory, "local-state.json.lock"));
    expect(await repository.getLocalState()).toEqual(initial);
  });
});
