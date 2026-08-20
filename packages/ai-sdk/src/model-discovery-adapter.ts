import {
  ModelDiscoveryError,
  type ModelDiscoveryPort,
  type ProviderConnectionWithCredential,
} from "@dictos/core";

export type Fetch = typeof fetch;

export class OpenAiCompatibleModelDiscoveryAdapter implements ModelDiscoveryPort {
  constructor(private fetchImplementation: Fetch = fetch) {}

  async listModels(
    connection: ProviderConnectionWithCredential
  ): Promise<string[] | ModelDiscoveryError> {
    const response = await this.fetchImplementation(
      `${connection.baseUrl.replace(/\/$/, "")}/models`,
      { headers: { Authorization: `Bearer ${connection.apiKey}` } }
    ).catch(
      (cause) =>
        new ModelDiscoveryError({
          operation: "request",
          reason: "Provider request failed",
          cause: sanitizeCause(cause),
        })
    );
    if (response instanceof ModelDiscoveryError) return response;
    if (!response.ok)
      return new ModelDiscoveryError({
        operation: "request",
        reason: `Provider returned HTTP ${response.status}`,
      });

    const body = await response.json().catch(
      (cause) =>
        new ModelDiscoveryError({
          operation: "parse_response",
          reason: "Provider returned invalid JSON",
          cause: sanitizeCause(cause),
        })
    );
    if (body instanceof ModelDiscoveryError) return body;
    if (!isModelResponse(body))
      return new ModelDiscoveryError({
        operation: "validate_response",
        reason: "Provider response does not contain Models",
      });
    return [...new Set(body.data.map((model) => model.id))].sort();
  }
}

function isModelResponse(value: unknown): value is { data: { id: string }[] } {
  if (
    !value ||
    typeof value !== "object" ||
    !("data" in value) ||
    !Array.isArray(value.data)
  )
    return false;
  return value.data.every(
    (model) =>
      model &&
      typeof model === "object" &&
      "id" in model &&
      typeof model.id === "string"
  );
}

function sanitizeCause(cause: unknown): Error {
  if (cause instanceof Error) return new Error(cause.message);
  return new Error("Provider request failed");
}
