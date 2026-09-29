import {
  ValidationError,
  type ModelCatalogError,
  type StorageError,
} from "../errors";
import type {
  CatalogModel,
  CatalogProvider,
  ModelCatalog,
  ProviderId,
  QualifiedModelId,
  SelectedModel,
} from "../models";
import { parseQualifiedModelId } from "../models/provider-connection";
import type { ModelCatalogPort } from "../ports/outbound/model-catalog-port";
import type { ProviderConnectionRepository } from "../ports/outbound/provider-connection-repository";

const eligible = (model: CatalogModel) =>
  model.textGeneration === true &&
  ["active", "alpha", "beta"].includes(model.status) &&
  model.inputModalities?.includes("text") &&
  model.outputModalities?.includes("text") &&
  model.protocol === undefined;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class ModelCatalogService {
  constructor(
    private readonly catalog: ModelCatalogPort,
    private readonly connections: ProviderConnectionRepository
  ) {}

  async supportedProviders(): Promise<CatalogProvider[] | ModelCatalogError> {
    const catalog = await this.catalog.get();
    if (catalog instanceof Error) return catalog;
    return [...catalog.providers].sort((a, b) => compare(a.id, b.id));
  }

  async configuredModels(input?: {
    providerId?: ProviderId;
  }): Promise<
    CatalogModel[] | ModelCatalogError | StorageError | ValidationError
  > {
    const catalog = await this.catalog.get();
    if (catalog instanceof Error) return catalog;
    if (
      input?.providerId !== undefined &&
      !catalog.providers.some((provider) => provider.id === input.providerId)
    )
      return new ValidationError({ reason: "Unknown Provider ID." });

    const connections = await this.connections.findAll();
    if (connections instanceof Error) return connections;
    const configured = new Set(
      connections.map((connection) => connection.providerId)
    );
    const supported = new Set(catalog.providers.map((provider) => provider.id));
    return catalog.models
      .filter(
        (model) =>
          configured.has(model.providerId) &&
          supported.has(model.providerId) &&
          (input?.providerId === undefined ||
            model.providerId === input.providerId) &&
          eligible(model)
      )
      .sort(
        (a, b) =>
          compare(a.providerId, b.providerId) || compare(a.modelId, b.modelId)
      );
  }

  async requireEligibleModel(
    qualifiedId: QualifiedModelId
  ): Promise<SelectedModel | ModelCatalogError | ValidationError> {
    const selected = parseQualifiedModelId(qualifiedId);
    if (selected instanceof Error) return selected;
    const catalog = await this.catalog.get();
    if (catalog instanceof Error) return catalog;
    if (
      !catalog.providers.some(
        (provider) => provider.id === selected.providerId
      ) ||
      !catalog.models.some(
        (model) =>
          model.providerId === selected.providerId &&
          model.modelId === selected.modelId &&
          eligible(model)
      )
    )
      return new ValidationError({
        reason:
          "Unknown or ineligible Model. Choose a listed Model or refresh the Model Catalog.",
      });
    return selected;
  }

  async refresh(): Promise<ModelCatalog | ModelCatalogError> {
    return await this.catalog.refresh();
  }
}
