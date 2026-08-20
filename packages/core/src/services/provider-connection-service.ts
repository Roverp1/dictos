import {
  ModelDiscoveryError,
  NotFoundError,
  ValidationError,
  type StorageError,
} from "../errors";
import type { ProviderConnection, ProviderPreset } from "../models";
import type {
  ModelDiscoveryPort,
  ProviderConnectionRepository,
  ProviderPresetCatalog,
} from "../ports/outbound";

export class ProviderConnectionService {
  constructor(
    private connections: ProviderConnectionRepository,
    private presets: ProviderPresetCatalog,
    private discovery: ModelDiscoveryPort
  ) {}

  async createConnection(input: {
    name: string;
    presetId?: string;
    baseUrl?: string;
    apiKey: string;
  }): Promise<ProviderConnection | StorageError | ValidationError> {
    const resolved = this.resolve(input);
    if (resolved instanceof Error) return resolved;
    return await this.connections.save({ ...resolved, apiKey: input.apiKey });
  }

  async getConnections(): Promise<ProviderConnection[] | StorageError> {
    return await this.connections.findAll();
  }

  async updateConnection(input: {
    id: string;
    name?: string;
    presetId?: string | null;
    baseUrl?: string;
    apiKey?: string;
  }): Promise<ProviderConnection | StorageError | ValidationError> {
    if (input.name !== undefined && input.name.trim() === "")
      return new ValidationError({
        reason: "Provider Connection name cannot be empty.",
      });
    if (input.baseUrl !== undefined && input.presetId !== undefined)
      return new ValidationError({
        reason: "Choose a Provider preset or a custom endpoint, not both.",
      });
    const preset =
      input.presetId === undefined || input.presetId === null
        ? null
        : this.presets.findPreset(input.presetId);
    if (
      input.presetId !== undefined &&
      input.presetId !== null &&
      preset === null
    )
      return new ValidationError({ reason: "Unknown Provider preset." });
    return await this.connections.update(input.id, {
      name: input.name,
      presetId: input.presetId,
      baseUrl: preset?.baseUrl ?? input.baseUrl,
      apiKey: input.apiKey,
    });
  }

  async deleteConnection(
    id: string
  ): Promise<ProviderConnection | StorageError> {
    return await this.connections.delete(id);
  }

  getPresets(): readonly ProviderPreset[] {
    return this.presets.listPresets();
  }

  async discoverModels(
    connectionId: string
  ): Promise<string[] | StorageError | NotFoundError | ModelDiscoveryError> {
    const connection = await this.connections.findById(connectionId);
    if (connection instanceof Error) return connection;
    if (connection === null)
      return new NotFoundError({
        entity: "Provider Connection",
        id: connectionId,
      });
    return await this.discovery.listModels(connection);
  }

  private resolve(input: {
    name: string;
    presetId?: string;
    baseUrl?: string;
  }):
    | { name: string; presetId: string | null; baseUrl: string }
    | ValidationError {
    if (input.name.trim() === "")
      return new ValidationError({
        reason: "Provider Connection name cannot be empty.",
      });
    if (input.presetId !== undefined && input.baseUrl !== undefined)
      return new ValidationError({
        reason: "Choose a Provider preset or a custom endpoint, not both.",
      });
    if (input.presetId !== undefined) {
      const preset = this.presets.findPreset(input.presetId);
      if (preset === null)
        return new ValidationError({ reason: "Unknown Provider preset." });
      return { name: input.name, presetId: preset.id, baseUrl: preset.baseUrl };
    }
    if (input.baseUrl === undefined || input.baseUrl.trim() === "")
      return new ValidationError({
        reason: "A custom Provider endpoint is required.",
      });
    if (
      !/^https:\/\/[^\s]+$/i.test(input.baseUrl) &&
      !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
        input.baseUrl
      )
    )
      return new ValidationError({
        reason: "Provider endpoint must use HTTPS unless it is local.",
      });
    return { name: input.name, presetId: null, baseUrl: input.baseUrl };
  }
}
