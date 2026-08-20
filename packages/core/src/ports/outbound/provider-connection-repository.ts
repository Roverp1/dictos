import type { StorageError } from "../../errors";
import type {
  NewProviderConnection,
  ProviderConnection,
  ProviderConnectionWithCredential,
} from "../../models";

export interface ProviderConnectionRepository {
  save(
    input: NewProviderConnection
  ): Promise<ProviderConnection | StorageError>;
  findById(
    id: string
  ): Promise<ProviderConnectionWithCredential | StorageError | null>;
  findAll(): Promise<ProviderConnection[] | StorageError>;
  update(
    id: string,
    input: Partial<Omit<NewProviderConnection, "presetId">> & {
      presetId?: string | null;
    }
  ): Promise<ProviderConnection | StorageError>;
  delete(id: string): Promise<ProviderConnection | StorageError>;
}
