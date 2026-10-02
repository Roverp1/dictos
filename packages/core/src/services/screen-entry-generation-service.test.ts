import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "errore";

import { FsProviderConnectionRepository } from "../../../fs-storage/src/repositories/fs-provider-connection-repository";
import type { Logger } from "../../../logger/src/index";
import { ModelCatalogService } from "./model-catalog-service";
import { ScreenEntryGenerationService } from "./screen-entry-generation-service";
import type { CatalogModel, ModelCatalog } from "../models";
import type { ModelCatalogPort } from "../ports/outbound/model-catalog-port";
import type { ScreenEntryGenerationPort } from "../ports/outbound/screen-entry-generation-port";
import { InvalidGenerationResponseError, ValidationError } from "../errors";

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

const model: CatalogModel = {
  providerId: "openrouter",
  modelId: "anthropic/claude",
  name: "Claude",
  textGeneration: true,
  status: "active",
  inputModalities: ["text"],
  outputModalities: ["text"],
};
const selectedModel = { providerId: model.providerId, modelId: model.modelId };
const catalog: ModelCatalog = {
  source: "bundled",
  fetchedAt: "2026-10-02T00:00:00.000Z",
  providers: [{ id: model.providerId, name: "OpenRouter" }],
  models: [model],
};

async function createService(
  cleanup: errore.AsyncDisposableStack,
  generation: ScreenEntryGenerationPort,
  options: { configured?: boolean; models?: CatalogModel[] } = {}
) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-screen-generation-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const connections = new FsProviderConnectionRepository({
    dataDir: directory,
    logger,
  });
  if (options.configured !== false) {
    const created = await connections.create({
      providerId: "openrouter",
      apiKey: "secret-key",
    });
    if (created instanceof Error) throw created;
  }
  const catalogPort: ModelCatalogPort = {
    get: async () => ({ ...catalog, models: options.models ?? catalog.models }),
    refresh: async () => catalog,
  };
  return new ScreenEntryGenerationService(
    connections,
    new ModelCatalogService(catalogPort, connections),
    generation
  );
}

describe("ScreenEntryGenerationService", () => {
  test("generates missing Description Types from an unsaved Entry with an empty Instruction", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const requested: string[][] = [];
    const service = await createService(cleanup, {
      suggestSenses: async () => [],
      generateDescriptions: async (input) => {
        requested.push(input.targetTypes);
        return {
          senseName: "reading",
          descriptions: [{ type: "translation", text: "czytać" }],
        };
      },
    });

    const result = await service.generateDescriptions({
      entryText: " read ",
      descriptionText: " I read a book. ",
      senseName: "reading",
      existingDescriptions: [
        { type: "definition", text: "Interpret written text" },
      ],
      instructionText: "",
      model: selectedModel,
      targetTypes: ["definition", "translation"],
    });

    expect(result).toEqual({
      senseName: "reading",
      descriptions: [{ type: "translation", text: "czytać" }],
    });
    expect(requested).toEqual([["translation"]]);
  });

  test("rejects malformed Sense suggestions before showing them", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      suggestSenses: async () => [{ name: " ", definition: "blank" }],
      generateDescriptions: async () => ({
        senseName: "unused",
        descriptions: [],
      }),
    });

    const result = await service.suggestSenses({
      entryText: "read",
      descriptionText: null,
      instructionText: "",
      model: selectedModel,
    });

    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
  });

  test("rejects generation that changes the selected Sense", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      suggestSenses: async () => [],
      generateDescriptions: async () => ({
        senseName: "another interpretation",
        descriptions: [{ type: "definition", text: "The proposed text" }],
      }),
    });

    const result = await service.generateDescriptions({
      entryText: "read",
      descriptionText: null,
      senseName: "interpret written text",
      existingDescriptions: [],
      instructionText: "",
      model: selectedModel,
      targetTypes: ["definition"],
    });

    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
  });

  test("rejects a draft Description with an invalid Type before generation", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      suggestSenses: async () => [],
      generateDescriptions: async () => ({
        senseName: "reading",
        descriptions: [{ type: "translation", text: "czytać" }],
      }),
    });

    const result = await service.generateDescriptions({
      entryText: "read",
      descriptionText: null,
      senseName: "reading",
      existingDescriptions: [{ type: "unknown" as "misc", text: "untrusted" }],
      instructionText: "",
      model: selectedModel,
      targetTypes: ["translation"],
    });

    expect(result).toBeInstanceOf(ValidationError);
  });
});
