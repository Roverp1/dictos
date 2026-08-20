import { describe, expect, test } from "bun:test";

import { DescriptionGenerationService } from "./description-generation-service";
import type { DescriptionGenerationPort } from "../ports/outbound/description-generation-port";
import type { DescriptionGenerationRepository } from "../ports/outbound/description-generation-repository";
import type { DescriptionRepository } from "../ports/outbound/description-repository";
import type { EntryRepository } from "../ports/outbound/entry-repository";
import type { InstructionRepository } from "../ports/outbound/instruction-repository";
import type { ProviderConnectionRepository } from "../ports/outbound/provider-connection-repository";
import type { SenseRepository } from "../ports/outbound/sense-repository";
import { InvalidGenerationResponseError, ValidationError } from "../errors";

const now = new Date("2026-01-01T00:00:00.000Z");

function createService(generation: DescriptionGenerationPort) {
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
  const connections: ProviderConnectionRepository = {
    save: async () => connection,
    findById: async (id) => (id === connection.id ? connection : null),
    findAll: async () => [{ ...connection, apiKey: undefined }],
    update: async () => ({ ...connection, apiKey: undefined }),
    delete: async () => ({ ...connection, apiKey: undefined }),
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
  id: "connection-1",
  name: "Local provider",
  presetId: null,
  baseUrl: "http://localhost:1234/v1",
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
    const service = createService({
      generate: async () => ({
        target: {
          kind: "new",
          senseName: "greeting",
          duplicateCandidateSenseId: "sense-1",
        },
        descriptions: [{ type: "translation", text: "bonjour" }],
      }),
    });

    expect(
      await service.createProposal({
        sourceDescriptionId: sourceDescription.id,
        instructionId: instruction.id,
        providerConnectionId: connection.id,
        modelId: "test-model",
        targetTypes: ["translation"],
      })
    ).toEqual({
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
    const service = createService({
      generate: async () => ({
        target: {
          kind: "new",
          senseName: "greeting",
          duplicateCandidateSenseId: null,
        },
        descriptions: [{ type: "definition", text: "a greeting" }],
      }),
    });

    const result = await service.createProposal({
      sourceDescriptionId: sourceDescription.id,
      instructionId: instruction.id,
      providerConnectionId: connection.id,
      modelId: "test-model",
      targetTypes: ["translation"],
    });
    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
    if (!(result instanceof InvalidGenerationResponseError)) return;
    expect(result.reason).toBe(
      "Generated Descriptions contain invalid content or types."
    );
  });

  test("rejects duplicate requested Description types before generation", async () => {
    const service = createService({
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
      sourceDescriptionId: sourceDescription.id,
      instructionId: instruction.id,
      providerConnectionId: connection.id,
      modelId: "test-model",
      targetTypes: ["translation", "translation"],
    });
    expect(result).toBeInstanceOf(ValidationError);
    if (!(result instanceof ValidationError)) return;
    expect(result.reason).toBe("Description Types must be unique.");
  });
});
