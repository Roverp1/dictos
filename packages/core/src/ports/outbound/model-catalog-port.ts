import type { ModelCatalogError } from "../../errors";
import type { ModelCatalog } from "../../models/model-catalog";

export interface ModelCatalogPort {
  get(): Promise<ModelCatalog | ModelCatalogError>;
  refresh(): Promise<ModelCatalog | ModelCatalogError>;
}
