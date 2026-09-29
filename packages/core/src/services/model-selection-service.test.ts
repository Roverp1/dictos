import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "errore";
import type { Logger } from "../../../../packages/logger/src/index";

import { ModelCatalogAdapter } from "../../../../packages/ai-sdk/src/model-catalog-adapter";
import { FsModelCatalogStore } from "../../../../packages/fs-storage/src/repositories/fs-model-catalog-store";
import { FsProviderConnectionRepository } from "../../../../packages/fs-storage/src/repositories/fs-provider-connection-repository";
import { FsLocalStateRepository } from "../../../../packages/fs-storage/src/repositories/fs-local-state-repository";
import { NotFoundError, StorageError, ValidationError } from "../errors";
import { ModelCatalogService } from "./model-catalog-service";
import { ModelSelectionService } from "./model-selection-service";

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

const catalogResponse = (models: Record<string, unknown>) =>
  Response.json({
    deepseek: { id: "deepseek", name: "DeepSeek", models: {} },
    google: { id: "google", name: "Google", models: {} },
    groq: { id: "groq", name: "Groq", models: {} },
    openai: { id: "openai", name: "OpenAI", models: {} },
    openrouter: { id: "openrouter", name: "OpenRouter", models },
  });
const model = (id: string, changes: Record<string, unknown> = {}) => ({
  id,
  name: id,
  temperature: true,
  modalities: { input: ["text"], output: ["text"] },
  ...changes,
});

async function fixture(
  cleanup: errore.AsyncDisposableStack,
  models: () => Record<string, unknown> = () => ({
    "anthropic/claude": model("anthropic/claude"),
    alternative: model("alternative"),
    deprecated: model("deprecated", { status: "deprecated" }),
    image: model("image", {
      modalities: { input: ["image"], output: ["text"] },
    }),
  })
) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-selection-"));
  cleanup.defer(() => fs.rm(dataDir, { recursive: true, force: true }));
  const connections = new FsProviderConnectionRepository({ dataDir, logger });
  const state = new FsLocalStateRepository(dataDir);
  const catalog = new ModelCatalogService(
    new ModelCatalogAdapter({
      store: new FsModelCatalogStore({ dataDir }),
      logger,
      fetchImplementation: async () => catalogResponse(models()),
    }),
    connections
  );
  const refreshed = await catalog.refresh();
  if (refreshed instanceof Error) throw refreshed;
  return {
    service: new ModelSelectionService(catalog, connections, state),
    catalog,
    connections,
    state,
    dataDir,
  };
}

describe("ModelSelectionService", () => {
  test("has no automatic Model choice", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup);
    const saved = await connections.create({
      providerId: "openrouter",
      apiKey: "private-key",
    });
    if (saved instanceof Error) throw saved;
    expect(await service.current()).toBeNull();
    const result = await service.resolve({});
    expect(result).toBeInstanceOf(ValidationError);
    if (!(result instanceof Error)) throw new Error("Expected an error");
    expect(result.message).toMatch(/select.*Model|override/i);
  });

  test("selects a qualified Model, preserves device identity, and never returns credentials", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections, state } = await fixture(cleanup);
    const before = await state.getLocalState();
    if (before instanceof Error) throw before;
    const created = await connections.create({
      providerId: "openrouter",
      apiKey: "private-key",
    });
    if (created instanceof Error) throw created;
    const chosen = { providerId: "openrouter", modelId: "anthropic/claude" };
    expect(await service.select("openrouter/anthropic/claude")).toEqual(chosen);
    expect(await service.current()).toEqual(chosen);
    expect(await service.resolve({})).toEqual(chosen);
    const after = await state.getLocalState();
    if (after instanceof Error) throw after;
    expect(after.deviceId).toBe(before.deviceId);
    expect(JSON.stringify(await service.resolve({}))).not.toContain(
      "private-key"
    );
  });

  test("rejects unlisted, malformed, deprecated, and ineligible choices without saving one", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup);
    const created = await connections.create({
      providerId: "openrouter",
      apiKey: "private-key",
    });
    if (created instanceof Error) throw created;
    for (const id of [
      "openrouter/unknown",
      "openrouter/deprecated",
      "openrouter/image",
      "openrouter/",
      "other/model",
    ]) {
      const result = await service.select(id);
      expect(result).toBeInstanceOf(ValidationError);
      expect(await service.current()).toBeNull();
    }
  });

  test("requires a configured credential for selection and overrides", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service } = await fixture(cleanup);
    expect(await service.select("openrouter/alternative")).toBeInstanceOf(
      NotFoundError
    );
    expect(
      await service.resolve({ override: "openrouter/alternative" })
    ).toBeInstanceOf(NotFoundError);
    expect(await service.current()).toBeNull();
  });

  test("an explicit override does not change the saved choice", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup);
    const created = await connections.create({
      providerId: "openrouter",
      apiKey: "private-key",
    });
    if (created instanceof Error) throw created;
    expect(
      await service.resolve({ override: "openrouter/alternative" })
    ).toEqual({ providerId: "openrouter", modelId: "alternative" });
    expect(await service.current()).toBeNull();
    const selected = await service.select("openrouter/anthropic/claude");
    if (selected instanceof Error) throw selected;
    expect(
      await service.resolve({ override: "openrouter/alternative" })
    ).toEqual({
      providerId: "openrouter",
      modelId: "alternative",
    });
    expect(await service.current()).toEqual(selected);
    expect(
      await service.resolve({ override: "openrouter/unknown" })
    ).toBeInstanceOf(ValidationError);
    expect(await service.current()).toEqual(selected);
  });

  test("rejects stale choices and missing connections rather than falling back", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    let removed = false;
    const { service, connections, catalog } = await fixture(cleanup, () => ({
      ...(removed ? {} : { "anthropic/claude": model("anthropic/claude") }),
      alternative: model("alternative"),
    }));
    const created = await connections.create({
      providerId: "openrouter",
      apiKey: "private-key",
    });
    if (created instanceof Error) throw created;
    const selected = await service.select("openrouter/anthropic/claude");
    if (selected instanceof Error) throw selected;
    removed = true;
    const refreshed = await catalog.refresh();
    if (refreshed instanceof Error) throw refreshed;
    const missingModel = await service.current();
    expect(missingModel).toBeInstanceOf(ValidationError);
    if (!(missingModel instanceof Error)) throw new Error("Expected an error");
    expect(missingModel.message).toMatch(/refresh|listed/i);
    expect(await service.resolve({})).toBeInstanceOf(ValidationError);
    removed = false;
    const restored = await catalog.refresh();
    if (restored instanceof Error) throw restored;
    expect(await service.current()).toEqual(selected);
    const deleted = await connections.delete("openrouter");
    if (deleted instanceof Error) throw deleted;
    const missingConnection = await service.current();
    expect(missingConnection).toBeInstanceOf(NotFoundError);
    expect(await service.resolve({})).toBeInstanceOf(NotFoundError);
  });

  test("surfaces local storage failures without replacing the saved choice", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections, dataDir } = await fixture(cleanup);
    const created = await connections.create({
      providerId: "openrouter",
      apiKey: "private-key",
    });
    if (created instanceof Error) throw created;
    await fs.writeFile(path.join(dataDir, "local-state.json"), "{broken");
    expect(await service.current()).toBeInstanceOf(StorageError);
    expect(await service.select("openrouter/alternative")).toBeInstanceOf(
      StorageError
    );
    expect(await service.resolve({})).toBeInstanceOf(StorageError);
  });
});
