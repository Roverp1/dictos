import { ValidationError, type DbError } from "../errors";
import { descriptionTypes } from "../models/description";
import type {
  ScreenEntrySaveInput,
  ScreenEntrySaveResult,
} from "../models/screen-entry-save";
import type { ScreenEntrySaveRepository } from "../ports/outbound/screen-entry-save-repository";

export function validateScreenEntrySaveInput(
  input: ScreenEntrySaveInput
): ScreenEntrySaveInput | ValidationError {
  if (!input.entryText?.trim())
    return new ValidationError({ reason: "Entry cannot be empty." });
  if (!input.folderId?.trim())
    return new ValidationError({ reason: "Root Folder ID is required." });
  if (input.kind === "sense" && !input.senseName?.trim())
    return new ValidationError({ reason: "Sense name cannot be empty." });
  if (
    input.kind === "sense" &&
    input.descriptions?.some(({ type }) => !descriptionTypes.includes(type))
  )
    return new ValidationError({ reason: "Invalid Description Type." });
  if (
    input.kind === "sense" &&
    !input.descriptions?.some(({ text }) => text?.trim())
  )
    return new ValidationError({
      reason: "At least one typed Description is required.",
    });

  if (input.kind === "entry")
    return {
      ...input,
      descriptionText: input.descriptionText?.trim()
        ? input.descriptionText
        : null,
    };

  return {
    ...input,
    descriptionText:
      input.includeDescription && input.descriptionText?.trim()
        ? input.descriptionText
        : null,
    descriptions: input.descriptions.filter(({ text }) => text?.trim()),
  };
}

export class ScreenEntrySaveService {
  constructor(private readonly repository: ScreenEntrySaveRepository) {}

  async save(
    input: ScreenEntrySaveInput
  ): Promise<ScreenEntrySaveResult | ValidationError | DbError> {
    const validated = validateScreenEntrySaveInput(input);
    if (validated instanceof Error) return validated;

    return await this.repository.commit(validated);
  }
}
