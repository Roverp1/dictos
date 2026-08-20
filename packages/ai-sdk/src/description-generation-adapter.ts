import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import * as errore from "@dictos/errore";

import {
  DescriptionGenerationError,
  type DescriptionGenerationPort,
  type DescriptionGenerationRequest,
  type GeneratedProposal,
  InvalidGenerationResponseError,
} from "@dictos/core";

import type { Fetch } from "./model-discovery-adapter";

export class AiSdkDescriptionGenerationAdapter implements DescriptionGenerationPort {
  constructor(private fetchImplementation: Fetch = fetch) {}

  async generate(
    request: DescriptionGenerationRequest
  ): Promise<
    | GeneratedProposal
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  > {
    const provider = createOpenAICompatible({
      baseURL: request.connection.baseUrl,
      apiKey: request.connection.apiKey,
      name: "dictos-provider",
      fetch: this.fetchImplementation,
      supportsStructuredOutputs: false,
    });
    const targetShape =
      request.target.kind === "new"
        ? "Return a new Sense name, a duplicate candidate Sense ID or null, and Descriptions."
        : "Return only Descriptions for the existing Sense.";
    const result = await generateText({
      model: provider.chatModel(request.modelId),
      output: Output.object({
        schema: proposalSchema(request.target.kind === "new") as never,
      }),
      prompt: JSON.stringify({
        instruction: request.instruction,
        entry: request.entry,
        sourceDescription: request.sourceDescription,
        targetTypes: request.targetTypes,
        target: request.target,
        output: targetShape,
      }),
    }).catch(
      (cause) =>
        new DescriptionGenerationError({
          operation: "request",
          reason: "Provider request failed",
          cause: sanitizeCause(cause),
        })
    );
    if (result instanceof DescriptionGenerationError) return result;
    const output = errore.try(
      () => result.output,
      (cause) =>
        new InvalidGenerationResponseError({
          reason: "Provider output could not be read",
          cause: sanitizeCause(cause),
        })
    );
    if (output instanceof InvalidGenerationResponseError) return output;
    const proposal = parseProposal(output, request);
    if (proposal instanceof Error) return proposal;
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
            duplicateCandidateSenseId: { type: ["string", "null"] as const },
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
        },
      },
    },
    required: newSense
      ? ["senseName", "duplicateCandidateSenseId", "descriptions"]
      : ["descriptions"],
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

function sanitizeCause(_cause: unknown): Error {
  return new Error("Provider request failed");
}
