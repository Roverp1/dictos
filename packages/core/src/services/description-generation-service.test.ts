import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "errore";

import { DescriptionGenerationService } from "./description-generation-service";
import { ModelCatalogService } from "./model-catalog-service";
import { FsProviderConnectionRepository } from "../../../fs-storage/src/repositories/fs-provider-connection-repository";
import type { Logger } from "../../../logger/src/index";
import type { CatalogModel, ModelCatalog } from "../models";
import type { ModelCatalogPort } from "../ports/outbound/model-catalog-port";
import type { DescriptionGenerationPort } from "../ports/outbound/description-generation-port";
import type { DescriptionGenerationRepository } from "../ports/outbound/description-generation-repository";
import type { DescriptionRepository } from "../ports/outbound/description-repository";
import type { EntryRepository } from "../ports/outbound/entry-repository";
import type { InstructionRepository } from "../ports/outbound/instruction-repository";
import type { SenseRepository } from "../ports/outbound/sense-repository";
import {
  InvalidGenerationResponseError,
  ModelCatalogError,
  NotFoundError,
  ValidationError,
} from "../errors";

const now = new Date("2026-01-01T00:00:00.000Z");

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

const eligibleModel: CatalogModel = {
  providerId: "openrouter",
  modelId: "anthropic/claude",
  name: "Claude",
  textGeneration: true,
  status: "active",
  inputModalities: ["text"],
  outputModalities: ["text"],
};
const selectedModel = {
  providerId: eligibleModel.providerId,
  modelId: eligibleModel.modelId,
};
const proposalInput = {
  sourceDescriptionId: "description-1",
  instructionId: "instruction-1",
  model: selectedModel,
  targetTypes: ["translation" as const],
};

async function createService(
  cleanup: errore.AsyncDisposableStack,
  generation: DescriptionGenerationPort,
  options: {
    models?: CatalogModel[];
    configured?: boolean;
    catalogError?: ModelCatalogError;
  } = {}
) {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-generation-service-")
  );
  cleanup.defer(() => fs.rm(dataDir, { recursive: true, force: true }));
  const connections = new FsProviderConnectionRepository({ dataDir, logger });
  if (options.configured !== false) {
    const created = await connections.create(connection);
    if (created instanceof Error) throw created;
  }
  const catalog: ModelCatalog = {
    source: "bundled",
    fetchedAt: now.toISOString(),
    providers: [{ id: "openrouter", name: "OpenRouter" }],
    models: options.models ?? [eligibleModel],
  };
  const catalogPort: ModelCatalogPort = {
    get: async () => options.catalogError ?? catalog,
    refresh: async () => options.catalogError ?? catalog,
  };
  const descriptions: DescriptionRepository = {
    save: async () => sourceDescription,
    findById: async (id) =>
      id === sourceDescription.id ? sourceDescription : null,
    findByEntry: async () => [sourceDescription],
    findBySense: async () => [],
    update: async () => sourceDescription,
    assignSense: async () => sourceDescription,
    delete: async () => sourceDescription,
  };
  const entries: EntryRepository = {
    save: async () => entry,
    findById: async (id) => (id === entry.id ? entry : null),
    findByFolder: async () => [entry],
    update: async () => entry,
    delete: async () => entry,
  };
  const instructions: InstructionRepository = {
    save: async () => instruction,
    findById: async (id) => (id === instruction.id ? instruction : null),
    findAll: async () => [instruction],
    update: async () => instruction,
    delete: async () => instruction,
  };
  const senses: SenseRepository = {
    save: async () => sense,
    findById: async (id) => (id === sense.id ? sense : null),
    findByEntry: async () => [sense],
    update: async () => sense,
    delete: async () => sense,
  };
  const commits: DescriptionGenerationRepository = {
    commitProposal: async () => ({
      sense,
      sourceDescription,
      generatedDescriptions: [],
    }),
  };
  return new DescriptionGenerationService(
    descriptions,
    entries,
    instructions,
    connections,
    new ModelCatalogService(catalogPort, connections),
    senses,
    generation,
    commits
  );
}

const entry = {
  id: "entry-1",
  text: "hello",
  folderId: "folder-1",
  createdAt: now,
  modifiedAt: now,
};
const sourceDescription = {
  id: "description-1",
  text: "hello",
  entryId: entry.id,
  senseId: null,
  type: "misc" as const,
  createdAt: now,
  modifiedAt: now,
};
const instruction = {
  id: "instruction-1",
  name: null,
  text: "Generate a translation.",
  createdAt: now,
  modifiedAt: now,
};
const connection = {
  providerId: "openrouter",
  apiKey: "secret-key",
};
const sense = {
  id: "sense-1",
  entryId: entry.id,
  name: "greeting",
  createdAt: now,
  modifiedAt: now,
};

describe("DescriptionGenerationService", () => {
  test("creates a proposal for a new Sense when every requested type is generated", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      generate: async (request) => {
        expect(request.connection).toEqual(connection);
        expect(request.modelId).toBe("anthropic/claude");
        return {
          target: {
            kind: "new",
            senseName: "greeting",
            duplicateCandidateSenseId: "sense-1",
          },
          descriptions: [{ type: "translation", text: "bonjour" }],
        };
      },
    });

    expect(await service.createProposal(proposalInput)).toEqual({
      entryId: entry.id,
      sourceDescriptionId: sourceDescription.id,
      expectedSourceSenseId: null,
      target: {
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: "sense-1",
      },
      descriptions: [{ type: "translation", text: "bonjour" }],
    });
  });

  test("rejects a proposal that omits a requested Description type", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      generate: async () => ({
        target: {
          kind: "new",
          senseName: "greeting",
          duplicateCandidateSenseId: null,
        },
        descriptions: [{ type: "definition", text: "a greeting" }],
      }),
    });

    const result = await service.createProposal(proposalInput);
    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
    if (!(result instanceof InvalidGenerationResponseError)) return;
    expect(result.reason).toBe(
      "Generated Descriptions contain invalid content or types."
    );
  });

  test("rejects a duplicate candidate Sense outside the Entry", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      generate: async () => ({
        target: {
          kind: "new",
          senseName: "greeting",
          duplicateCandidateSenseId: "other-sense",
        },
        descriptions: [{ type: "translation", text: "bonjour" }],
      }),
    });

    const result = await service.createProposal(proposalInput);
    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
    if (!(result instanceof InvalidGenerationResponseError)) return;
    expect(result.reason).toBe(
      "Duplicate candidate does not belong to the Entry."
    );
  });

  test("rejects duplicate requested Description types before generation", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(cleanup, {
      generate: async () => ({
        target: {
          kind: "new",
          senseName: "greeting",
          duplicateCandidateSenseId: null,
        },
        descriptions: [],
      }),
    });

    const result = await service.createProposal({
      ...proposalInput,
      targetTypes: ["translation", "translation"],
    });
    expect(result).toBeInstanceOf(ValidationError);
    if (!(result instanceof ValidationError)) return;
    expect(result.reason).toBe("Description Types must be unique.");
  });

  test("rejects invalid and stale Models before a provider request", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(
      cleanup,
      {
        generate: async () => {
          throw new Error("Unexpected provider request");
        },
      },
      { models: [{ ...eligibleModel, inputModalities: ["image"] }] }
    );
    for (const model of [
      { providerId: "openrouter", modelId: "" },
      selectedModel,
      { providerId: "openrouter", modelId: "removed" },
      { providerId: "unknown", modelId: "model" },
    ]) {
      expect(
        await service.createProposal({ ...proposalInput, model })
      ).toBeInstanceOf(ValidationError);
    }
  });

  test("rejects a catalog Model without text-generation proof despite text modalities", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const withoutProof = {
      providerId: eligibleModel.providerId,
      modelId: eligibleModel.modelId,
      name: eligibleModel.name,
      status: eligibleModel.status,
      inputModalities: ["text"],
      outputModalities: ["text"],
    } as CatalogModel;
    const service = await createService(
      cleanup,
      {
        generate: async () => {
          throw new Error("Unexpected provider request");
        },
      },
      { models: [withoutProof] }
    );

    expect(await service.createProposal(proposalInput)).toBeInstanceOf(
      ValidationError
    );
  });

  test("rejects an unconfigured Provider before a provider request", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const service = await createService(
      cleanup,
      {
        generate: async () => {
          throw new Error("Unexpected provider request");
        },
      },
      { configured: false }
    );
    const result = await service.createProposal(proposalInput);
    expect(result).toBeInstanceOf(NotFoundError);
    if (!(result instanceof NotFoundError)) return;
    expect(result.id).toBe("openrouter");
  });

  test("propagates Model Catalog errors before a provider request", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const catalogError = new ModelCatalogError({
      operation: "get",
      reason: "Catalog unavailable.",
    });
    const service = await createService(
      cleanup,
      {
        generate: async () => {
          throw new Error("Unexpected provider request");
        },
      },
      { catalogError }
    );
    expect(await service.createProposal(proposalInput)).toBe(catalogError);
  });
});
