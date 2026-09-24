import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, jsonSchema, Output } from "ai";
import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";

import {
  DescriptionGenerationError,
  type DescriptionGenerationPort,
  type DescriptionGenerationRequest,
  type GeneratedProposal,
  InvalidGenerationResponseError,
} from "@dictos/core";

import type { Fetch } from "./model-discovery-adapter";
import {
  getAiSdkFailureDetails,
  providerFailureReason,
  sanitizedProviderCause,
} from "./provider-failure";

type AiSdkDescriptionGenerationAdapterOptions = {
  fetchImplementation?: Fetch;
  logger: Logger;
};

const MAX_PROVIDER_RETRIES = 2;

export class AiSdkDescriptionGenerationAdapter implements DescriptionGenerationPort {
  private fetchImplementation: Fetch;
  private logger: Logger;

  constructor({
    fetchImplementation = fetch,
    logger,
  }: AiSdkDescriptionGenerationAdapterOptions) {
    this.fetchImplementation = fetchImplementation;
    this.logger = logger;
  }

  async generate(
    request: DescriptionGenerationRequest
  ): Promise<
    | GeneratedProposal
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  > {
    const startedAt = performance.now();
    const logContext = {
      providerConnectionId: request.connection.id,
      modelId: request.modelId,
      targetKind: request.target.kind,
      targetTypes: request.targetTypes,
      maxRetries: MAX_PROVIDER_RETRIES,
    };
    const provider = createOpenAICompatible({
      baseURL: request.connection.baseUrl,
      apiKey: request.connection.apiKey,
      name: "dictos-provider",
      fetch: this.fetchImplementation as typeof fetch,
      supportsStructuredOutputs: false,
    });
    const outputRequirements =
      request.target.kind === "new"
        ? "Return a non-empty Sense name, a duplicate candidate Sense ID from the supplied existing Senses or null, and Descriptions covering every requested Description Type."
        : "Return only Descriptions for the existing Sense, covering every requested Description Type.";
    const outputExample = {
      ...(request.target.kind === "new"
        ? {
            senseName: "Example Sense",
            duplicateCandidateSenseId: null,
          }
        : {}),
      descriptions: request.targetTypes.map((type) => ({
        type,
        text: "Example Description text",
      })),
    };
    const result = await generateText({
      model: provider.chatModel(request.modelId),
      maxRetries: MAX_PROVIDER_RETRIES,
      maxOutputTokens: 4096,
      output: Output.object({
        schema: jsonSchema(
          proposalSchema(request.target.kind === "new") as never
        ),
      }),
      system:
        "Return only valid JSON using exactly the JSON shape shown in the example. Do not use Markdown or add extra keys.",
      prompt: JSON.stringify({
        instruction: request.instruction,
        entry: request.entry,
        sourceDescription: request.sourceDescription,
        targetTypes: request.targetTypes,
        target: request.target,
        output: {
          format: "JSON",
          requirements: outputRequirements,
          example: outputExample,
        },
      }),
    }).catch((cause) => {
      const details = getAiSdkFailureDetails(cause);
      const error = new DescriptionGenerationError({
        operation: "request",
        reason: providerFailureReason({
          operation: "description_generation",
          statusCode: details.statusCode,
        }),
        cause: sanitizedProviderCause(details.statusCode),
      });
      this.logger.error(
        "Description Generation provider request failed",
        error,
        {
          ...logContext,
          ...details,
          durationMs: Math.round(performance.now() - startedAt),
        }
      );
      return error;
    });
    if (result instanceof DescriptionGenerationError) return result;
    const output = errore.try(
      () => result.output,
      (cause) =>
        new InvalidGenerationResponseError({
          reason:
            "Provider returned invalid JSON. Try again or use another Model.",
          cause: sanitizedOutputCause(cause),
        })
    );
    if (output instanceof InvalidGenerationResponseError) {
      this.logger.error(
        "Description Generation provider response failed validation",
        output,
        {
          ...logContext,
          phase: "decode",
          durationMs: Math.round(performance.now() - startedAt),
        }
      );
      return output;
    }
    const proposal = parseProposal(output, request);
    if (proposal instanceof Error) {
      this.logger.error(
        "Description Generation provider response failed validation",
        proposal,
        {
          ...logContext,
          phase: "validate",
          durationMs: Math.round(performance.now() - startedAt),
        }
      );
      return proposal;
    }
    this.logger.info("Description Generation provider request completed", {
      ...logContext,
      descriptionCount: proposal.descriptions.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return proposal;
  }
}

function proposalSchema(newSense: boolean) {
  return {
    type: "object" as const,
    properties: {
      ...(newSense
        ? {
            senseName: { type: "string" as const },
            duplicateCandidateSenseId: {
              type: ["string", "null"] as const,
            },
          }
        : {}),
      descriptions: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            type: { type: "string" as const },
            text: { type: "string" as const },
          },
          required: ["type", "text"],
          additionalProperties: false,
        },
      },
    },
    required: newSense
      ? ["senseName", "duplicateCandidateSenseId", "descriptions"]
      : ["descriptions"],
    additionalProperties: false,
  };
}

function parseProposal(
  value: unknown,
  request: DescriptionGenerationRequest
): GeneratedProposal | InvalidGenerationResponseError {
  if (
    !value ||
    typeof value !== "object" ||
    !("descriptions" in value) ||
    !Array.isArray(value.descriptions)
  )
    return new InvalidGenerationResponseError({
      reason: "Response has no Descriptions.",
    });
  const descriptions = value.descriptions;
  if (
    !descriptions.every(
      (description) =>
        description &&
        typeof description === "object" &&
        "type" in description &&
        "text" in description &&
        typeof description.type === "string" &&
        typeof description.text === "string"
    )
  )
    return new InvalidGenerationResponseError({
      reason: "Response Descriptions are malformed.",
    });
  const validDescriptions = descriptions.map(({ type, text }) => ({
    type,
    text,
  })) as GeneratedProposal["descriptions"];
  if (request.target.kind === "existing")
    return {
      target: { kind: "existing", senseId: request.target.sense.id },
      descriptions: validDescriptions,
    };
  if (
    !("senseName" in value) ||
    typeof value.senseName !== "string" ||
    !("duplicateCandidateSenseId" in value) ||
    (value.duplicateCandidateSenseId !== null &&
      typeof value.duplicateCandidateSenseId !== "string")
  )
    return new InvalidGenerationResponseError({
      reason: "Response new Sense target is malformed.",
    });
  return {
    target: {
      kind: "new",
      senseName: value.senseName,
      duplicateCandidateSenseId: value.duplicateCandidateSenseId,
    },
    descriptions: validDescriptions,
  };
}

function sanitizedOutputCause(_cause: unknown): Error {
  return new Error("Provider output could not be read");
}
