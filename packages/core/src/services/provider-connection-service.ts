import {
  NotFoundError,
  ValidationError,
  type ModelCatalogError,
  type StorageError,
} from "../errors";
import type { ProviderConnection, ProviderId } from "../models";
import type {
  LocalStateRepository,
  ProviderConnectionRepository,
} from "../ports/outbound";
import { ModelCatalogService } from "./model-catalog-service";

export class ProviderConnectionService {
  constructor(
    private readonly connections: ProviderConnectionRepository,
    private readonly catalog: ModelCatalogService,
    private readonly localState: LocalStateRepository
  ) {}

  async connect(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<
    ProviderConnection | ValidationError | StorageError | ModelCatalogError
  > {
    if (!input.apiKey.trim())
      return new ValidationError({
        reason: "Provider API key cannot be empty.",
      });
    const providers = await this.catalog.supportedProviders();
    if (providers instanceof Error) return providers;
    if (!providers.some((provider) => provider.id === input.providerId))
      return new ValidationError({ reason: "Unknown Provider ID." });

    return await this.connections.create(input);
  }

  async replaceKey(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<
    ProviderConnection | ValidationError | NotFoundError | StorageError
  > {
    if (!input.apiKey.trim())
      return new ValidationError({
        reason: "Provider API key cannot be empty.",
      });
    const existing = await this.connections.findByProviderId(input.providerId);
    if (existing instanceof Error) return existing;
    if (existing === null)
      return new NotFoundError({
        entity: "Provider Connection",
        id: "requested",
      });
    const replaced = await this.connections.replaceKey(input);
    if (replaced instanceof Error) return replaced;
    if (replaced === null)
      return new NotFoundError({
        entity: "Provider Connection",
        id: "requested",
      });
    return replaced;
  }

  async getConnections(): Promise<ProviderConnection[] | StorageError> {
    return await this.connections.findAll();
  }

  async disconnect(
    providerId: ProviderId
  ): Promise<ProviderConnection | NotFoundError | StorageError> {
    const existing = await this.connections.findByProviderId(providerId);
    if (existing instanceof Error) return existing;
    if (existing === null)
      return new NotFoundError({
        entity: "Provider Connection",
        id: "requested",
      });

    const state = await this.localState.getLocalState();
    if (state instanceof Error) return state;
    if (state.selectedModel?.providerId === providerId) {
      const cleared = await this.localState.setSelectedModel(null);
      if (cleared instanceof Error) return cleared;
    }

    const deleted = await this.connections.delete(providerId);
    if (deleted instanceof Error) return deleted;
    if (deleted === null)
      return new NotFoundError({
        entity: "Provider Connection",
        id: "requested",
      });
    return deleted;
  }
}
