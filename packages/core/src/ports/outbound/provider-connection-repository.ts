import type { StorageError, ValidationError } from "../../errors";
import type {
  ProviderConnection,
  ProviderConnectionWithCredential,
  ProviderId,
} from "../../models";

export interface ProviderConnectionRepository {
  // A duplicate Provider ID is a ValidationError; existing credentials stay unchanged.
  create(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | ValidationError | StorageError>;
  findByProviderId(
    providerId: ProviderId
  ): Promise<ProviderConnectionWithCredential | StorageError | null>;
  findAll(): Promise<ProviderConnection[] | StorageError>;
  replaceKey(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | StorageError | null>;
  delete(
    providerId: ProviderId
  ): Promise<ProviderConnection | StorageError | null>;
}
