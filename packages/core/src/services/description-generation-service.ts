import {
  type DbError,
  DescriptionGenerationError,
  type GenerationConflictError,
  InvalidGenerationResponseError,
  NotFoundError,
  type StorageError,
  ValidationError,
} from "../errors";
import type {
  DescriptionGenerationProposal,
  DescriptionGenerationResult,
  DescriptionType,
  GenerationSenseContext,
} from "../models";
import type {
  DescriptionGenerationPort,
  DescriptionGenerationRepository,
  DescriptionRepository,
  EntryRepository,
  InstructionRepository,
  ProviderConnectionRepository,
  SenseRepository,
} from "../ports/outbound";

export class DescriptionGenerationService {
  constructor(
    private descriptions: DescriptionRepository,
    private entries: EntryRepository,
    private instructions: InstructionRepository,
    private connections: ProviderConnectionRepository,
    private senses: SenseRepository,
    private generation: DescriptionGenerationPort,
    private commits: DescriptionGenerationRepository
  ) {}

  async createProposal(input: {
    sourceDescriptionId: string;
    instructionId: string;
    providerConnectionId: string;
    modelId: string;
    targetTypes: DescriptionType[];
  }): Promise<
    | DescriptionGenerationProposal
    | DbError
    | StorageError
    | NotFoundError
    | ValidationError
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  > {
    if (input.targetTypes.length === 0)
      return new ValidationError({
        reason: "At least one Description Type is required.",
      });
    if (new Set(input.targetTypes).size !== input.targetTypes.length)
      return new ValidationError({
        reason: "Description Types must be unique.",
      });

    const source = await this.descriptions.findById(input.sourceDescriptionId);
    if (source instanceof Error) return source;
    if (source === null)
      return new NotFoundError({
        entity: "Description",
        id: input.sourceDescriptionId,
      });
    const entry = await this.entries.findById(source.entryId);
    if (entry instanceof Error) return entry;
    if (entry === null)
      return new NotFoundError({ entity: "Entry", id: source.entryId });
    const instruction = await this.instructions.findById(input.instructionId);
    if (instruction instanceof Error) return instruction;
    if (instruction === null)
      return new NotFoundError({
        entity: "Instruction",
        id: input.instructionId,
      });
    const connection = await this.connections.findById(
      input.providerConnectionId
    );
    if (connection instanceof Error) return connection;
    if (connection === null)
      return new NotFoundError({
        entity: "Provider Connection",
        id: input.providerConnectionId,
      });

    const allSenses = await this.senses.findByEntry(entry.id);
    if (allSenses instanceof Error) return allSenses;
    const contexts = await Promise.all(
      allSenses.map(async (sense) => {
        const descriptions = await this.descriptions.findBySense(sense.id);
        if (descriptions instanceof Error) return descriptions;
        const context: GenerationSenseContext = {
          id: sense.id,
          name: sense.name,
          descriptions: descriptions.map(({ type, text }) => ({ type, text })),
        };
        return context;
      })
    );
    const failedContext = contexts.find((context) => context instanceof Error);
    if (failedContext instanceof Error) return failedContext;
    const validContexts = contexts as GenerationSenseContext[];
    const target =
      source.senseId === null
        ? { kind: "new" as const, existingSenses: validContexts }
        : (() => {
            const sense = validContexts.find(
              (item) => item.id === source.senseId
            );
            return sense ? { kind: "existing" as const, sense } : null;
          })();
    if (target === null)
      return new ValidationError({
        reason: "Source Description references a missing Sense.",
      });

    const generated = await this.generation.generate({
      connection,
      modelId: input.modelId,
      instruction: instruction.text,
      entry: { id: entry.id, text: entry.text },
      sourceDescription: {
        id: source.id,
        text: source.text,
        type: source.type,
        senseId: source.senseId,
      },
      targetTypes: input.targetTypes,
      target,
    });
    if (generated instanceof Error) return generated;
    const types = new Set(
      generated.descriptions.map((description) => description.type)
    );
    if (
      generated.descriptions.some(
        (description) =>
          description.text.trim() === "" ||
          !input.targetTypes.includes(description.type)
      )
    )
      return new InvalidGenerationResponseError({
        reason: "Generated Descriptions contain invalid content or types.",
      });
    if (input.targetTypes.some((type) => !types.has(type)))
      return new InvalidGenerationResponseError({
        reason:
          "Generated Descriptions do not cover every requested Description Type.",
      });
    const generatedTarget = generated.target;
    if (source.senseId !== null && generatedTarget.kind !== "existing")
      return new InvalidGenerationResponseError({
        reason: "Generated target does not match the source Sense.",
      });
    if (
      generatedTarget.kind === "existing" &&
      generatedTarget.senseId !== source.senseId
    )
      return new InvalidGenerationResponseError({
        reason: "Generated target does not match the source Sense.",
      });
    if (generatedTarget.kind === "new") {
      if (generatedTarget.senseName.trim() === "")
        return new InvalidGenerationResponseError({
          reason: "Generated Sense name is empty.",
        });
      if (
        generatedTarget.duplicateCandidateSenseId !== null &&
        !validContexts.some(
          (sense) => sense.id === generatedTarget.duplicateCandidateSenseId
        )
      )
        return new InvalidGenerationResponseError({
          reason: "Duplicate candidate does not belong to the Entry.",
        });
    }

    return {
      entryId: entry.id,
      sourceDescriptionId: source.id,
      expectedSourceSenseId: source.senseId,
      target: generated.target,
      descriptions: generated.descriptions,
    };
  }

  async commitProposal(
    proposal: DescriptionGenerationProposal
  ): Promise<DescriptionGenerationResult | DbError | GenerationConflictError> {
    return await this.commits.commitProposal(proposal);
  }
}
