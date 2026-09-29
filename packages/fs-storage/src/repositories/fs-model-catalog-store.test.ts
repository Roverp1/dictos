import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StorageError, type ModelCatalog } from "@dictos/core";
import * as errore from "@dictos/errore";

import { FsModelCatalogStore } from "./fs-model-catalog-store";

const catalog: ModelCatalog = {
  source: "bundled",
  fetchedAt: "2026-09-28T12:00:00.000Z",
  providers: [{ id: "openrouter", name: "OpenRouter" }],
  models: [
    {
      providerId: "openrouter",
      modelId: "vendor/model-v1",
      name: "Vendor Model",
      status: "active",
      inputModalities: ["text"],
      outputModalities: ["text"],
      cost: { input: 0, output: 1.5 },
    },
  ],
};

async function createStore(cleanup: errore.AsyncDisposableStack) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, store: new FsModelCatalogStore({ dataDir: directory }) };
}

describe("FsModelCatalogStore", () => {
  test("a missing cache has no catalog", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { store } = await createStore(cleanup);
    expect(await store.read()).toBeNull();
  });

  test("replaces a catalog and reads a validated cache with owner-only permissions", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, store } = await createStore(cleanup);
    const saved = await store.replace(catalog);
    if (saved instanceof Error) throw saved;

    expect(await store.read()).toEqual({ ...catalog, source: "cache" });
    const filePath = path.join(directory, "model-catalog.json");
    expect((await fs.stat(filePath)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await fs.readFile(filePath, "utf8"))).toMatchObject({
      version: 1,
      fetchedAt: catalog.fetchedAt,
    });
    expect(await fs.readdir(directory)).toEqual(["model-catalog.json"]);
  });

  test("corrupt JSON and invalid cache data return errors, not fallback catalogs", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, store } = await createStore(cleanup);
    const filePath = path.join(directory, "model-catalog.json");
    await fs.writeFile(filePath, '{"name":"\u001b[31m",');
    const corrupt = await store.read();
    expect(corrupt).toBeInstanceOf(StorageError);
    if (!(corrupt instanceof StorageError)) return;
    expect(corrupt.operation).toBe("parse_model_catalog");
    expect(JSON.stringify(corrupt)).not.toContain("31m");

    await fs.writeFile(
      filePath,
      JSON.stringify({ ...catalog, version: 1, models: [{}] })
    );
    const invalid = await store.read();
    expect(invalid).toBeInstanceOf(StorageError);
    if (!(invalid instanceof StorageError)) return;
    expect(invalid.operation).toBe("validate_model_catalog");
  });

  test("ignores unrelated cache fields instead of returning untrusted data", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, store } = await createStore(cleanup);
    await fs.writeFile(
      path.join(directory, "model-catalog.json"),
      JSON.stringify({
        ...catalog,
        version: 1,
        unexpected: "\u001b[2J",
        models: [{ ...catalog.models[0], unexpected: "\u001b[2J" }],
      })
    );
    expect(await store.read()).toEqual({ ...catalog, source: "cache" });
  });

  test("rejects untrusted names and IDs on read and before replacement", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, store } = await createStore(cleanup);
    const saved = await store.replace(catalog);
    if (saved instanceof Error) throw saved;
    const filePath = path.join(directory, "model-catalog.json");
    const original = await fs.readFile(filePath, "utf8");

    const hostile = [
      { ...catalog, providers: [{ id: "openrouter", name: "Fake\u001b[2J" }] },
      {
        ...catalog,
        models: [{ ...catalog.models[0], modelId: "bad\u0085id" }],
      },
      {
        ...catalog,
        models: [{ ...catalog.models[0], modelId: "bad\u202Eid" }],
      },
      { ...catalog, models: [{ ...catalog.models[0], modelId: "" }] },
      { ...catalog, models: [{ ...catalog.models[0], providerId: "unknown" }] },
      {
        ...catalog,
        models: [{ ...catalog.models[0], cost: { input: -1, output: 0 } }],
      },
    ];
    for (const value of hostile) {
      await fs.writeFile(filePath, JSON.stringify({ ...value, version: 1 }));
      expect(await store.read()).toBeInstanceOf(StorageError);
      await fs.writeFile(filePath, original);
      expect(await store.replace(value as ModelCatalog)).toBeInstanceOf(
        StorageError
      );
      expect(await fs.readFile(filePath, "utf8")).toBe(original);
    }
    expect(await fs.readdir(directory)).toEqual(["model-catalog.json"]);
  });

  test("a failed replacement preserves the previous cache and cleans up the temporary file", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, store } = await createStore(cleanup);
    const saved = await store.replace(catalog);
    if (saved instanceof Error) throw saved;
    const filePath = path.join(directory, "model-catalog.json");
    const original = await fs.readFile(filePath, "utf8");

    // A parent directory at the destination makes rename fail after the temp file was written.
    const blockedDirectory = path.join(directory, "blocked");
    await fs.mkdir(path.join(blockedDirectory, "model-catalog.json"), {
      recursive: true,
    });
    const blockedStore = new FsModelCatalogStore({ dataDir: blockedDirectory });
    const failed = await blockedStore.replace(catalog);
    expect(failed).toBeInstanceOf(StorageError);
    if (!(failed instanceof StorageError)) return;
    expect(failed.operation).toBe("replace_model_catalog");
    expect(await fs.readdir(blockedDirectory)).toEqual(["model-catalog.json"]);
    expect(await fs.readFile(filePath, "utf8")).toBe(original);
    expect(await store.read()).toEqual({ ...catalog, source: "cache" });

    const missingParent = new FsModelCatalogStore({
      dataDir: path.join(directory, "missing"),
    });
    expect(await missingParent.replace(catalog)).toBeInstanceOf(StorageError);
    expect(await fs.readdir(directory)).toEqual([
      "blocked",
      "model-catalog.json",
    ]);
  });
});
