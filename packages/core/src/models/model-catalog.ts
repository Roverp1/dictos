import type { ModelId, ProviderId } from "./provider-connection";

export interface CatalogProvider {
  id: ProviderId;
  name: string;
}

export interface CatalogModel {
  providerId: ProviderId;
  modelId: ModelId;
  name: string;
  textGeneration: true;
  status: "active" | "alpha" | "beta";
  inputModalities: string[];
  outputModalities: string[];
  cost?: { input: number; output: number };
  // Metadata only: an override must be checked against Dictos-owned routes.
  protocol?: string;
}

export interface ModelCatalog {
  source: "bundled" | "cache";
  fetchedAt: string;
  providers: CatalogProvider[];
  models: CatalogModel[];
}
