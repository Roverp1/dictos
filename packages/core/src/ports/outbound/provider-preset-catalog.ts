import type { ProviderPreset } from "../../models";

export interface ProviderPresetCatalog {
  listPresets(): readonly ProviderPreset[];
  findPreset(id: string): ProviderPreset | null;
}
