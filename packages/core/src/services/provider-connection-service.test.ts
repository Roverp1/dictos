import { describe, expect, test } from "bun:test";

import { ValidationError } from "../errors";
import type {
  ProviderConnection,
  ProviderConnectionWithCredential,
  ProviderPreset,
} from "../models";
import type {
  ModelDiscoveryPort,
  ProviderConnectionRepository,
  ProviderPresetCatalog,
} from "../ports/outbound";
import { ProviderConnectionService } from "./provider-connection-service";

function createProviderConnectionService() {
  const existing: ProviderConnectionWithCredential = {
    id: "connection-1",
    name: "Provider",
    presetId: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "secret-key",
  };
  const summary: ProviderConnection = {
    id: existing.id,
    name: existing.name,
    presetId: existing.presetId,
    baseUrl: existing.baseUrl,
  };
  const connections: ProviderConnectionRepository = {
    save: async () => summary,
    findById: async () => existing,
    findAll: async () => [summary],
    update: async (id, input) => ({
      id,
      name: input.name ?? existing.name,
      presetId:
        input.presetId === undefined ? existing.presetId : input.presetId,
      baseUrl: input.baseUrl ?? existing.baseUrl,
    }),
    delete: async () => summary,
  };
  const preset: ProviderPreset = {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
  };
  const presets: ProviderPresetCatalog = {
    listPresets: () => [preset],
    findPreset: (id) => (id === preset.id ? preset : null),
  };
  const discovery: ModelDiscoveryPort = {
    listModels: async () => [],
  };
  return {
    existing,
    summary,
    service: new ProviderConnectionService(connections, presets, discovery),
  };
}

describe("ProviderConnectionService", () => {
  test("switches a preset connection to a custom endpoint", async () => {
    const { existing, service, summary } = createProviderConnectionService();

    const result = await service.updateConnection({
      id: existing.id,
      presetId: null,
      baseUrl: "https://custom.example/v1",
    });

    if (result instanceof Error) throw result;
    expect(result).toEqual({
      ...summary,
      presetId: null,
      baseUrl: "https://custom.example/v1",
    });
  });

  test("rejects selecting a preset and custom endpoint together", async () => {
    const { existing, service } = createProviderConnectionService();

    const result = await service.updateConnection({
      id: existing.id,
      presetId: "openai",
      baseUrl: "https://custom.example/v1",
    });

    expect(result).toBeInstanceOf(ValidationError);
    if (!(result instanceof ValidationError)) return;
    expect(result.reason).toBe(
      "Choose a Provider preset or a custom endpoint, not both."
    );
  });

  test("rejects credentials embedded in custom endpoints", async () => {
    const { existing, service } = createProviderConnectionService();

    const created = await service.createConnection({
      name: "Unsafe provider",
      baseUrl: "https://user:password@provider.example/v1",
      apiKey: "secret-key",
    });
    const updated = await service.updateConnection({
      id: existing.id,
      presetId: null,
      baseUrl: "https://token@provider.example/v1",
    });

    expect(created).toBeInstanceOf(ValidationError);
    expect(updated).toBeInstanceOf(ValidationError);
    if (!(created instanceof ValidationError)) return;
    if (!(updated instanceof ValidationError)) return;
    expect(created.reason).toBe(
      "Provider endpoint must not contain credentials."
    );
    expect(updated.reason).toBe(
      "Provider endpoint must not contain credentials."
    );
  });
});
