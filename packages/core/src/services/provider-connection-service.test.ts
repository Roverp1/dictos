import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "errore";
import type { Logger } from "../../../../packages/logger/src/index";

import { ModelCatalogAdapter } from "../../../../packages/ai-sdk/src/model-catalog-adapter";
import { FsModelCatalogStore } from "../../../../packages/fs-storage/src/repositories/fs-model-catalog-store";
import { FsLocalStateRepository } from "../../../../packages/fs-storage/src/repositories/fs-local-state-repository";
import { FsProviderConnectionRepository } from "../../../../packages/fs-storage/src/repositories/fs-provider-connection-repository";
import { NotFoundError, StorageError, ValidationError } from "../errors";
import { ModelCatalogService } from "./model-catalog-service";
import { ProviderConnectionService } from "./provider-connection-service";

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

async function fixture(cleanup: errore.AsyncDisposableStack) {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-provider-service-")
  );
  cleanup.defer(() => fs.rm(dataDir, { recursive: true, force: true }));
  const connections = new FsProviderConnectionRepository({ dataDir, logger });
  const state = new FsLocalStateRepository(dataDir);
  const catalog = new ModelCatalogService(
    new ModelCatalogAdapter({
      store: new FsModelCatalogStore({ dataDir }),
      logger,
      fetchImplementation: async () => {
        throw new Error("Unexpected catalog HTTP request");
      },
    }),
    connections
  );
  return {
    service: new ProviderConnectionService(connections, catalog, state),
    connections,
    state,
    dataDir,
  };
}

describe("ProviderConnectionService", () => {
  test("connect accepts a supported Provider and returns only its ID", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup);
    const connected = await service.connect({
      providerId: "google",
      apiKey: "secret-key",
    });
    if (connected instanceof Error) throw connected;
    expect(connected).toEqual({ providerId: "google" });
    const listed = await service.getConnections();
    if (listed instanceof Error) throw listed;
    expect(listed).toEqual([{ providerId: "google" }]);
    const stored = await connections.findByProviderId("google");
    if (stored instanceof Error) throw stored;
    expect(stored?.apiKey).toBe("secret-key");
    expect(JSON.stringify([connected, listed])).not.toContain("secret-key");
  });

  test("connect rejects unsupported IDs and blank keys without saving a connection", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service } = await fixture(cleanup);
    expect(
      await service.connect({ providerId: "unsupported", apiKey: "secret" })
    ).toBeInstanceOf(ValidationError);
    expect(
      await service.connect({ providerId: "google", apiKey: " \t " })
    ).toBeInstanceOf(ValidationError);
    expect(await service.getConnections()).toEqual([]);
  });

  test("connect refuses a duplicate without overwriting the saved key", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup);
    const first = await service.connect({
      providerId: "google",
      apiKey: "original",
    });
    if (first instanceof Error) throw first;
    expect(
      await service.connect({ providerId: "google", apiKey: "replacement" })
    ).toBeInstanceOf(ValidationError);
    expect(await connections.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "original",
    });
  });

  test("replaceKey requires a connection and only changes its credential", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections } = await fixture(cleanup);
    expect(
      await service.replaceKey({ providerId: "google", apiKey: "new" })
    ).toBeInstanceOf(NotFoundError);
    expect(
      await service.replaceKey({ providerId: "google", apiKey: " " })
    ).toBeInstanceOf(ValidationError);
    const first = await service.connect({
      providerId: "google",
      apiKey: "old",
    });
    if (first instanceof Error) throw first;
    const replaced = await service.replaceKey({
      providerId: "google",
      apiKey: "new",
    });
    expect(replaced).toEqual({ providerId: "google" });
    expect(await connections.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "new",
    });
  });

  test("disconnect clears only the matching Selected Model before removing the credential", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, state, connections } = await fixture(cleanup);
    for (const providerId of ["google", "openai"]) {
      const result = await service.connect({
        providerId,
        apiKey: `secret-${providerId}`,
      });
      if (result instanceof Error) throw result;
    }
    const saved = await state.setSelectedModel({
      providerId: "openai",
      modelId: "gpt-4o",
    });
    if (saved instanceof Error) throw saved;
    expect(await service.disconnect("google")).toEqual({
      providerId: "google",
    });
    expect(await state.getLocalState()).toEqual(saved);
    expect(await service.disconnect("openai")).toEqual({
      providerId: "openai",
    });
    const after = await state.getLocalState();
    if (after instanceof Error) throw after;
    expect(after).toEqual({ deviceId: saved.deviceId, selectedModel: null });
    expect(await connections.findAll()).toEqual([]);
    expect(await service.disconnect("openai")).toBeInstanceOf(NotFoundError);
  });

  test("a failed Selected Model read leaves the credential configured", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, connections, dataDir } = await fixture(cleanup);
    const connected = await service.connect({
      providerId: "google",
      apiKey: "secret",
    });
    if (connected instanceof Error) throw connected;
    await fs.writeFile(path.join(dataDir, "local-state.json"), "{broken");
    expect(await service.disconnect("google")).toBeInstanceOf(StorageError);
    expect(await connections.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret",
    });
  });

  test("a failed credential deletion leaves the Provider configured but unselected", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, state, connections, dataDir } = await fixture(cleanup);
    const connected = await service.connect({
      providerId: "google",
      apiKey: "secret",
    });
    if (connected instanceof Error) throw connected;
    const saved = await state.setSelectedModel({
      providerId: "google",
      modelId: "gemini",
    });
    if (saved instanceof Error) throw saved;
    await fs.mkdir(path.join(dataDir, "providers.json.lock"));
    expect(await service.disconnect("google")).toBeInstanceOf(StorageError);
    expect(await state.getLocalState()).toEqual({
      deviceId: saved.deviceId,
      selectedModel: null,
    });
    expect(await connections.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret",
    });
  });

  test("storage failures stay errors and do not expose credentials", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { service, dataDir } = await fixture(cleanup);
    await fs.writeFile(path.join(dataDir, "providers.json"), "{secret-key");
    const result = await service.getConnections();
    expect(result).toBeInstanceOf(StorageError);
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });
});
