import type { ModelDiscoveryError } from "../../errors";
import type { ProviderConnectionWithCredential } from "../../models";

export interface ModelDiscoveryPort {
  listModels(
    connection: ProviderConnectionWithCredential
  ): Promise<string[] | ModelDiscoveryError>;
}
