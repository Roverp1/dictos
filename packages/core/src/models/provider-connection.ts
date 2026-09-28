export type ModelId = string;

export interface ProviderConnection {
  id: string;
  name: string;
  presetId: string | null;
  baseUrl: string;
}

export interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

export interface NewProviderConnection {
  name: string;
  presetId: string | null;
  baseUrl: string;
  apiKey: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
}
