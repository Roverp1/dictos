import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ProviderFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => ReturnType<typeof fetch>;

export function providerModel({
  providerId,
  apiKey,
  modelId,
  fetchImplementation,
}: {
  providerId: string;
  apiKey: string;
  modelId: string;
  fetchImplementation: ProviderFetch;
}) {
  const sdkFetch = fetchImplementation as typeof fetch;
  if (providerId === "openai")
    return createOpenAI({ apiKey, fetch: sdkFetch }).chat(modelId);
  if (providerId === "google")
    return createGoogle({ apiKey, fetch: sdkFetch })(modelId);
  const baseURL = {
    openrouter: "https://openrouter.ai/api/v1",
    deepseek: "https://api.deepseek.com/v1",
    groq: "https://api.groq.com/openai/v1",
  }[providerId];
  if (!baseURL) return null;
  return createOpenAICompatible({
    baseURL,
    apiKey,
    name: "dictos-provider",
    fetch: sdkFetch,
    supportsStructuredOutputs: false,
  }).chatModel(modelId);
}
