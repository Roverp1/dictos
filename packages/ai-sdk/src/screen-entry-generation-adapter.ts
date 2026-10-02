import { generateText, jsonSchema, NoObjectGeneratedError, Output } from "ai";
import * as errore from "@dictos/errore";
import {
  DescriptionGenerationError,
  InvalidGenerationResponseError,
  type GenerationDraft,
  type ScreenEntryGenerationPort,
  type SenseCandidate,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

import {
  getAiSdkFailureDetails,
  providerFailureReason,
  sanitizedProviderCause,
} from "./provider-failure";
import { providerModel, type ProviderFetch } from "./provider-model";

type SuggestInput = Parameters<ScreenEntryGenerationPort["suggestSenses"]>[0];
type GenerateInput = Parameters<
  ScreenEntryGenerationPort["generateDescriptions"]
>[0];

const MAX_PROVIDER_RETRIES = 2;
const INVALID_JSON =
  "Provider returned invalid JSON. Try again or use another Model.";

const senseSchema = {
  type: "object" as const,
  properties: {
    senses: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          definition: { type: "string" as const },
        },
        required: ["name", "definition"],
        additionalProperties: false,
      },
    },
  },
  required: ["senses"],
  additionalProperties: false,
};

function draftSchema(needsSense: boolean) {
  return {
    type: "object" as const,
    properties: {
      ...(needsSense ? { senseName: { type: "string" as const } } : {}),
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
    required: needsSense ? ["senseName", "descriptions"] : ["descriptions"],
    additionalProperties: false,
  };
}

function invalidResponse(reason: string) {
  return new InvalidGenerationResponseError({ reason });
}

function sanitizedOutputCause(_cause: unknown) {
  return new Error("Provider output could not be read");
}

function parseSenses(
  value: unknown
): SenseCandidate[] | InvalidGenerationResponseError {
  if (
    !value ||
    typeof value !== "object" ||
    !("senses" in value) ||
    !Array.isArray(value.senses)
  )
    return invalidResponse("Response has no Sense candidates.");
  const senses: SenseCandidate[] = [];
  const names = new Set<string>();
  for (const candidate of value.senses.slice(0, 20)) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      typeof candidate.name !== "string" ||
      !candidate.name.trim() ||
      typeof candidate.definition !== "string" ||
      !candidate.definition.trim() ||
      candidate.definition.length > 240
    )
      return invalidResponse("Response Sense candidate is malformed.");
    const name = candidate.name.trim().toLocaleLowerCase();
    if (names.has(name))
      return invalidResponse("Response contains duplicate Sense candidates.");
    names.add(name);
    senses.push({ name: candidate.name, definition: candidate.definition });
  }
  return senses;
}

function parseDraft(
  value: unknown,
  input: GenerateInput
): GenerationDraft | InvalidGenerationResponseError {
  if (
    !value ||
    typeof value !== "object" ||
    !("descriptions" in value) ||
    !Array.isArray(value.descriptions)
  )
    return invalidResponse("Response has no Descriptions.");
  const senseName =
    input.senseName === null
      ? "senseName" in value
        ? value.senseName
        : null
      : input.senseName;
  if (typeof senseName !== "string" || !senseName.trim())
    return invalidResponse("Response Sense name is blank or malformed.");
  const descriptions: GenerationDraft["descriptions"] = [];
  const types = new Set<string>();
  for (const description of value.descriptions) {
    if (
      !description ||
      typeof description !== "object" ||
      typeof description.type !== "string" ||
      !input.targetTypes.includes(description.type) ||
      typeof description.text !== "string" ||
      !description.text.trim()
    )
      return invalidResponse("Response Descriptions are malformed.");
    types.add(description.type);
    descriptions.push({ type: description.type, text: description.text });
  }
  if (types.size !== input.targetTypes.length)
    return invalidResponse("Response is missing requested Description Types.");
  return { senseName, descriptions };
}

export class AiSdkScreenEntryGenerationAdapter implements ScreenEntryGenerationPort {
  constructor(
    private readonly options: {
      logger: Logger;
      fetchImplementation?: ProviderFetch;
    }
  ) {}

  suggestSenses(input: SuggestInput) {
    return this.request({
      input,
      operation: "suggest",
      schema: senseSchema,
      requirements:
        "Return JSON with up to 20 distinct nonblank Sense names and short nonblank definition previews. Favor the captured Description when present; otherwise suggest plausible interpretations. Previews are not saved Descriptions.",
      example: {
        senses: [
          { name: "Example Sense", definition: "Short definition preview" },
        ],
      },
      parse: (output: unknown) => parseSenses(output),
    });
  }

  generateDescriptions(input: GenerateInput) {
    return this.request({
      input,
      operation: "generate",
      schema: draftSchema(input.senseName === null),
      requirements:
        input.senseName === null
          ? "Propose a nonblank Sense name and return at least one nonblank Description for every requested Description Type. Multiple Descriptions of one Type are allowed."
          : "Generate at least one nonblank Description for every requested Description Type under the supplied Sense. Multiple Descriptions of one Type are allowed. Do not change the Sense.",
      example: {
        ...(input.senseName === null ? { senseName: "Example Sense" } : {}),
        descriptions: input.targetTypes.map((type) => ({
          type,
          text: "Example Description text",
        })),
      },
      parse: (output: unknown) => parseDraft(output, input),
    });
  }

  private async request<T>({
    input,
    operation,
    schema,
    requirements,
    example,
    parse,
  }: {
    input: SuggestInput | GenerateInput;
    operation: "suggest" | "generate";
    schema: ReturnType<typeof draftSchema> | typeof senseSchema;
    requirements: string;
    example: object;
    parse: (output: unknown) => T | InvalidGenerationResponseError;
  }): Promise<T | DescriptionGenerationError | InvalidGenerationResponseError> {
    const startedAt = performance.now();
    const { providerId, apiKey } = input.connection;
    const context = {
      providerId,
      modelId: input.modelId,
      operation,
      maxRetries: MAX_PROVIDER_RETRIES,
    };
    const model = providerModel({
      providerId,
      apiKey,
      modelId: input.modelId,
      fetchImplementation: this.options.fetchImplementation ?? fetch,
    });
    if (model === null) {
      const error = new DescriptionGenerationError({
        operation: "request",
        reason: "Unsupported Provider. Choose a supported Provider Connection.",
      });
      this.options.logger.error(
        "Screen Entry Generation provider request failed",
        error,
        context
      );
      return error;
    }
    const result = await generateText({
      model,
      providerOptions:
        providerId === "google" ? { google: { structuredOutputs: false } } : {},
      maxRetries: MAX_PROVIDER_RETRIES,
      maxOutputTokens: 4096,
      output: Output.object({ schema: jsonSchema(schema as never) }),
      instructions:
        "Return only valid JSON using exactly the JSON shape shown in the example. Do not use Markdown or add extra keys.",
      prompt: JSON.stringify({
        entryText: input.entryText,
        descriptionText: input.descriptionText,
        instructionText: input.instructionText,
        ...(operation === "suggest"
          ? { limit: 20 }
          : {
              senseName: (input as GenerateInput).senseName,
              existingDescriptions: (input as GenerateInput)
                .existingDescriptions,
              targetTypes: (input as GenerateInput).targetTypes,
            }),
        output: { format: "JSON", requirements, example },
      }),
    }).catch((cause: unknown) => {
      if (NoObjectGeneratedError.isInstance(cause)) {
        const error = new InvalidGenerationResponseError({
          reason: INVALID_JSON,
          cause: sanitizedOutputCause(cause),
        });
        this.options.logger.error(
          "Screen Entry Generation provider response failed validation",
          error,
          {
            ...context,
            phase: "decode",
            durationMs: Math.round(performance.now() - startedAt),
          }
        );
        return error;
      }
      const details = getAiSdkFailureDetails(cause);
      const error = new DescriptionGenerationError({
        operation: "request",
        reason: providerFailureReason({
          operation: "description_generation",
          statusCode: details.statusCode,
        }),
        cause: sanitizedProviderCause(details.statusCode),
      });
      this.options.logger.error(
        "Screen Entry Generation provider request failed",
        error,
        {
          ...context,
          ...details,
          durationMs: Math.round(performance.now() - startedAt),
        }
      );
      return error;
    });
    if (result instanceof Error) return result;
    const output = errore.try(
      () => result.output as Record<string, unknown>,
      (cause) =>
        new InvalidGenerationResponseError({
          reason: INVALID_JSON,
          cause: sanitizedOutputCause(cause),
        })
    );
    const parsed =
      output instanceof InvalidGenerationResponseError ? output : parse(output);
    if (parsed instanceof Error) {
      this.options.logger.error(
        "Screen Entry Generation provider response failed validation",
        parsed,
        {
          ...context,
          phase: "validate",
          durationMs: Math.round(performance.now() - startedAt),
        }
      );
      return parsed;
    }
    this.options.logger.info(
      "Screen Entry Generation provider request completed",
      {
        ...context,
        durationMs: Math.round(performance.now() - startedAt),
      }
    );
    return parsed;
  }
}
