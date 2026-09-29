import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "errore";
import type { Logger } from "../../../../packages/logger/src/index";

import { ModelCatalogError, StorageError, ValidationError } from "../errors";
import { ModelCatalogAdapter } from "../../../../packages/ai-sdk/src/model-catalog-adapter";
import { FsModelCatalogStore } from "../../../../packages/fs-storage/src/repositories/fs-model-catalog-store";
import { FsProviderConnectionRepository } from "../../../../packages/fs-storage/src/repositories/fs-provider-connection-repository";
import { ModelCatalogService } from "./model-catalog-service";

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

async function fixture(
  cleanup: errore.AsyncDisposableStack,
  fetchImplementation: ConstructorParameters<
    typeof ModelCatalogAdapter
  >[0]["fetchImplementation"] = async () => {
    throw new Error("Unexpected catalog HTTP request");
  }
) {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-model-service-")
  );
  cleanup.defer(() => fs.rm(dataDir, { recursive: true, force: true }));
  const connections = new FsProviderConnectionRepository({ dataDir, logger });
  const catalog = new ModelCatalogAdapter({
    store: new FsModelCatalogStore({ dataDir }),
    logger,
    fetchImplementation,
  });
  return {
    service: new ModelCatalogService(catalog, connections),
    connections,
    dataDir,
  };
}

const model = (id: string, changes: Record<string, unknown> = {}) => ({
  id,
  name: id,
  modalities: { input: ["text"], output: ["text"] },
  ...changes,
});

const upstream = () => ({
  google: {
    id: "google",
    name: "Google",
    models: { zebra: model("zebra"), alpha: model("alpha") },
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    models: {
      "anthropic/claude": model("anthropic/claude"),
      deprecated: model("deprecated", { status: "deprecated" }),
      image: model("image", {
        modalities: { input: ["image"], output: ["text"] },
      }),
      "no-output": model("no-output", {
        modalities: { input: ["text"], output: ["image"] },
      }),
      override: model("override", { provider: { npm: "untrusted-sdk" } }),
    },
  },
  unsupported: {
    id: "unsupported",
    name: "Unsupported",
    models: { extra: model("extra") },
  },
});

describe("ModelCatalogService", () => {
  test("lists supported Providers without Provider Connections", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service } = await fixture(cleanup);
    const result = await service.supportedProviders();
    if (result instanceof Error) throw result;
    expect(result.map((provider) => provider.id)).toEqual([
      "deepseek",
      "google",
      "groq",
      "openai",
      "openrouter",
    ]);
  });

  test("lists configured eligible Models sorted by Provider ID and Model ID", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup, async () =>
      Response.json(upstream())
    );
    for (const providerId of ["openrouter", "unsupported", "google"]) {
      const saved = await connections.create({ providerId, apiKey: "secret" });
      if (saved instanceof Error) throw saved;
    }
    const refreshed = await service.refresh();
    if (refreshed instanceof Error) throw refreshed;
    expect(refreshed.source).toBe("cache");
    const listed = await service.configuredModels();
    if (listed instanceof Error) throw listed;
    expect(
      listed.map(({ providerId, modelId }) => `${providerId}/${modelId}`)
    ).toEqual(["google/alpha", "google/zebra", "openrouter/anthropic/claude"]);
    const filtered = await service.configuredModels({
      providerId: "openrouter",
    });
    if (filtered instanceof Error) throw filtered;
    expect(filtered.map(({ modelId }) => modelId)).toEqual([
      "anthropic/claude",
    ]);
    expect(
      await service.configuredModels({ providerId: "unsupported" })
    ).toBeInstanceOf(ValidationError);
    expect(
      await service.configuredModels({ providerId: "missing" })
    ).toBeInstanceOf(ValidationError);
  });

  test("requires a catalog-listed eligible Model but not configured credentials", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service } = await fixture(cleanup, async () =>
      Response.json(upstream())
    );
    const refreshed = await service.refresh();
    if (refreshed instanceof Error) throw refreshed;
    expect(
      await service.requireEligibleModel("openrouter/anthropic/claude")
    ).toEqual({
      providerId: "openrouter",
      modelId: "anthropic/claude",
    });
    for (const id of [
      "unsupported/extra",
      "openrouter/deprecated",
      "openrouter/image",
      "openrouter/no-output",
      "openrouter/override",
      "openrouter/not-listed",
      "openrouter/",
    ]) {
      const result = await service.requireEligibleModel(id);
      expect(result).toBeInstanceOf(ValidationError);
      if (!(result instanceof Error)) throw new Error("Expected rejection");
      expect(result.message).not.toContain("untrusted-sdk");
    }
  });

  test("a configured Provider gains newly cataloged Models after refresh", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    let updated = false;
    const { service, connections } = await fixture(cleanup, async () =>
      Response.json({
        google: {
          id: "google",
          name: "Google",
          models: updated
            ? { original: model("original"), new: model("new") }
            : { original: model("original") },
        },
      })
    );
    const saved = await connections.create({
      providerId: "google",
      apiKey: "secret",
    });
    if (saved instanceof Error) throw saved;
    expect(await service.requireEligibleModel("google/new")).toBeInstanceOf(
      ValidationError
    );
    updated = true;
    const refreshed = await service.refresh();
    if (refreshed instanceof Error) throw refreshed;
    expect(await service.requireEligibleModel("google/new")).toEqual({
      providerId: "google",
      modelId: "new",
    });
    const listed = await service.configuredModels({ providerId: "google" });
    if (listed instanceof Error) throw listed;
    expect(listed.map(({ modelId }) => modelId)).toEqual(["new", "original"]);
  });

  test("propagates Provider Connection storage failures", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, dataDir } = await fixture(cleanup);
    await fs.writeFile(path.join(dataDir, "providers.json"), "{broken");
    expect(await service.configuredModels()).toBeInstanceOf(StorageError);
    const providers = await service.supportedProviders();
    if (providers instanceof Error) throw providers;
    expect(providers).toHaveLength(5);
  });

  test("a failed refresh surfaces its error and keeps the last usable catalog", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections, dataDir } = await fixture(cleanup, async () =>
      Response.json(upstream())
    );
    const saved = await connections.create({
      providerId: "google",
      apiKey: "secret",
    });
    if (saved instanceof Error) throw saved;
    const refreshed = await service.refresh();
    if (refreshed instanceof Error) throw refreshed;
    const failing = new ModelCatalogService(
      new ModelCatalogAdapter({
        store: new FsModelCatalogStore({ dataDir }),
        logger,
        fetchImplementation: async () => {
          throw new Error("offline-secret");
        },
      }),
      connections
    );
    const failure = await failing.refresh();
    expect(failure).toBeInstanceOf(ModelCatalogError);
    expect(JSON.stringify(failure)).not.toContain("offline-secret");
    const listed = await failing.configuredModels({ providerId: "google" });
    if (listed instanceof Error) throw listed;
    expect(listed.map(({ modelId }) => modelId)).toEqual(["alpha", "zebra"]);
  });
});
