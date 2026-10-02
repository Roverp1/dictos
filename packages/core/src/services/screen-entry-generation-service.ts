import {
  InvalidGenerationResponseError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { descriptionTypes } from "../models/description";
import type {
  DescriptionType,
  GenerationDraft,
  ScreenDescriptionInput,
  ScreenGenerationFailure,
  SelectedModel,
  SenseCandidate,
} from "../models";
import type {
  ProviderConnectionRepository,
  ScreenEntryGenerationPort,
} from "../ports/outbound";
import type { ModelCatalogService } from "./model-catalog-service";

export class ScreenEntryGenerationService {
  constructor(
    private readonly connections: ProviderConnectionRepository,
    private readonly catalog: ModelCatalogService,
    private readonly generation: ScreenEntryGenerationPort
  ) {}

  async suggestSenses(input: {
    entryText: string;
    descriptionText: string | null;
    instructionText: string;
    model: SelectedModel;
  }): Promise<SenseCandidate[] | ScreenGenerationFailure> {
    if (!input.entryText.trim())
      return new ValidationError({ reason: "Entry cannot be empty." });
    const connection = await this.resolveConnection(input.model);
    if (connection instanceof Error) return connection;
    const candidates = await this.generation.suggestSenses({
      connection,
      modelId: input.model.modelId,
      entryText: input.entryText,
      descriptionText: input.descriptionText?.trim()
        ? input.descriptionText
        : null,
      instructionText: input.instructionText,
      limit: 20,
    });
    if (candidates instanceof Error) return candidates;
    const names = candidates.map((candidate) =>
      candidate.name.trim().toLocaleLowerCase()
    );
    if (
      candidates.length > 20 ||
      candidates.some(
        ({ name, definition }) => !name.trim() || !definition.trim()
      ) ||
      new Set(names).size !== names.length
    )
      return new InvalidGenerationResponseError({
        reason: "Sense suggestions are invalid.",
      });
    return candidates;
  }

  async generateDescriptions(input: {
    entryText: string;
    descriptionText: string | null;
    senseName: string | null;
    existingDescriptions: ScreenDescriptionInput[];
    instructionText: string;
    model: SelectedModel;
    targetTypes: DescriptionType[];
  }): Promise<GenerationDraft | ScreenGenerationFailure> {
    if (!input.entryText.trim())
      return new ValidationError({ reason: "Entry cannot be empty." });
    if (
      input.targetTypes.length === 0 ||
      new Set(input.targetTypes).size !== input.targetTypes.length ||
      input.targetTypes.some((type) => !descriptionTypes.includes(type))
    )
      return new ValidationError({ reason: "Choose valid Description Types." });
    if (
      input.existingDescriptions.some(
        ({ type, text }) =>
          !descriptionTypes.includes(type) || typeof text !== "string"
      )
    )
      return new ValidationError({ reason: "Invalid draft Description." });

    const existing = input.existingDescriptions.filter(({ text }) =>
      text.trim()
    );
    const filled = new Set(existing.map(({ type }) => type));
    const targetTypes = input.targetTypes.filter((type) => !filled.has(type));
    if (targetTypes.length === 0)
      return new ValidationError({
        reason: "Selected Descriptions already have text.",
      });

    const connection = await this.resolveConnection(input.model);
    if (connection instanceof Error) return connection;
    const generated = await this.generation.generateDescriptions({
      connection,
      modelId: input.model.modelId,
      entryText: input.entryText,
      descriptionText: input.descriptionText?.trim()
        ? input.descriptionText
        : null,
      senseName: input.senseName?.trim() ? input.senseName : null,
      existingDescriptions: existing,
      instructionText: input.instructionText,
      targetTypes,
    });
    if (generated instanceof Error) return generated;
    if (
      !generated.senseName.trim() ||
      (input.senseName?.trim() && generated.senseName !== input.senseName) ||
      generated.descriptions.some(
        ({ type, text }) => !targetTypes.includes(type) || !text.trim()
      ) ||
      targetTypes.some(
        (type) =>
          !generated.descriptions.some(
            (description) => description.type === type
          )
      )
    )
      return new InvalidGenerationResponseError({
        reason:
          "Generated Descriptions do not match the requested Sense or Types.",
      });
    return generated;
  }

  private async resolveConnection(model: SelectedModel) {
    const selected = await this.catalog.requireEligibleModel(
      `${model.providerId}/${model.modelId}`
    );
    if (selected instanceof Error) return selected;
    const connection = await this.connections.findByProviderId(
      selected.providerId
    );
    if (connection instanceof Error) return connection;
    if (connection === null || !connection.apiKey.trim())
      return new NotFoundError({
        entity: "Configured Provider Connection",
        id: selected.providerId,
      });
    return connection;
  }
}
