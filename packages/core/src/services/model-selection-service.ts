import {
  NotFoundError,
  ValidationError,
  type ModelCatalogError,
  type StorageError,
} from "../errors";
import type { QualifiedModelId, SelectedModel } from "../models";
import type { LocalStateRepository } from "../ports/outbound/local-state-repository";
import type { ProviderConnectionRepository } from "../ports/outbound/provider-connection-repository";
import type { ModelCatalogService } from "./model-catalog-service";

export class ModelSelectionService {
  constructor(
    private readonly catalog: ModelCatalogService,
    private readonly connections: ProviderConnectionRepository,
    private readonly state: LocalStateRepository
  ) {}

  async select(
    qualifiedId: QualifiedModelId
  ): Promise<
    | SelectedModel
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  > {
    const selected = await this.validate(qualifiedId);
    if (selected instanceof Error) return selected;
    const saved = await this.state.setSelectedModel(selected);
    if (saved instanceof Error) return saved;
    return selected;
  }

  async current(): Promise<
    | SelectedModel
    | null
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  > {
    const state = await this.state.getLocalState();
    if (state instanceof Error) return state;
    if (state.selectedModel === null) return null;
    return this.validate(
      `${state.selectedModel.providerId}/${state.selectedModel.modelId}`
    );
  }

  async resolve(input: {
    override?: QualifiedModelId;
  }): Promise<
    | SelectedModel
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  > {
    if (input.override !== undefined) return this.validate(input.override);
    const selected = await this.current();
    if (selected === null)
      return new ValidationError({
        reason: "Select a Model or supply an explicit Model override.",
      });
    return selected;
  }

  private async validate(qualifiedId: QualifiedModelId) {
    const selected = await this.catalog.requireEligibleModel(qualifiedId);
    if (selected instanceof Error) return selected;
    const connection = await this.connections.findByProviderId(
      selected.providerId
    );
    if (connection instanceof Error) return connection;
    if (connection === null || !connection.apiKey.trim())
      return new NotFoundError({
        entity: "Configured Provider Connection; connect the Provider",
        id: selected.providerId,
      });
    return selected;
  }
}
