import {
  ModelDiscoveryError,
  type ModelDiscoveryPort,
  type ProviderConnectionWithCredential,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

import {
  providerFailureReason,
  sanitizedProviderCause,
} from "./provider-failure";

export type Fetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => ReturnType<typeof fetch>;

type OpenAiCompatibleModelDiscoveryAdapterOptions = {
  fetchImplementation?: Fetch;
  logger: Logger;
};

export class OpenAiCompatibleModelDiscoveryAdapter implements ModelDiscoveryPort {
  private fetchImplementation: Fetch;
  private logger: Logger;

  constructor({
    fetchImplementation = fetch,
    logger,
  }: OpenAiCompatibleModelDiscoveryAdapterOptions) {
    this.fetchImplementation = fetchImplementation;
    this.logger = logger;
  }

  async listModels(
    connection: ProviderConnectionWithCredential
  ): Promise<string[] | ModelDiscoveryError> {
    const startedAt = performance.now();
    const logContext = { providerConnectionId: connection.id };
    const response = await this.fetchImplementation(
      `${connection.baseUrl.replace(/\/$/, "")}/models`,
      { headers: { Authorization: `Bearer ${connection.apiKey}` } }
    ).catch((_cause) => {
      const error = new ModelDiscoveryError({
        operation: "request",
        reason: providerFailureReason({
          operation: "model_discovery",
          statusCode: undefined,
        }),
        cause: sanitizedProviderCause(undefined),
      });
      this.logger.error("Model discovery failed", error, {
        ...logContext,
        phase: "request",
        durationMs: Math.round(performance.now() - startedAt),
      });
      return error;
    });
    if (response instanceof ModelDiscoveryError) return response;
    if (!response.ok) {
      const error = new ModelDiscoveryError({
        operation: "request",
        reason: providerFailureReason({
          operation: "model_discovery",
          statusCode: response.status,
        }),
        cause: sanitizedProviderCause(response.status),
      });
      this.logger.error("Model discovery failed", error, {
        ...logContext,
        phase: "request",
        statusCode: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return error;
    }

    const body = await response.json().catch(
      (_cause) =>
        new ModelDiscoveryError({
          operation: "parse_response",
          reason: "Provider returned invalid JSON",
          cause: new Error("Provider response could not be parsed"),
        })
    );
    if (body instanceof ModelDiscoveryError) {
      this.logger.error("Model discovery failed", body, {
        ...logContext,
        phase: "parse_response",
        durationMs: Math.round(performance.now() - startedAt),
      });
      return body;
    }
    if (!isModelResponse(body)) {
      const error = new ModelDiscoveryError({
        operation: "validate_response",
        reason: "Provider response does not contain Models",
      });
      this.logger.error("Model discovery failed", error, {
        ...logContext,
        phase: "validate_response",
        durationMs: Math.round(performance.now() - startedAt),
      });
      return error;
    }
    const models = [...new Set(body.data.map((model) => model.id))].sort();
    this.logger.info("Model discovery completed", {
      ...logContext,
      modelCount: models.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return models;
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
