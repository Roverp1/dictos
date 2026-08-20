import type { ProviderPreset, ProviderPresetCatalog } from "@dictos/core";

const presets: readonly ProviderPreset[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
];

export class StaticProviderPresetCatalog implements ProviderPresetCatalog {
  listPresets(): readonly ProviderPreset[] {
    return presets;
  }

  findPreset(id: string): ProviderPreset | null {
    return presets.find((preset) => preset.id === id) ?? null;
  }
}
