import type { StorageError } from "../../errors";
import type { ModelCatalog } from "../../models/model-catalog";

export interface ModelCatalogStore {
  read(): Promise<ModelCatalog | StorageError | null>;
  replace(catalog: ModelCatalog): Promise<void | StorageError>;
}
