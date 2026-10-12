import type { DescriptionType } from "./description";
import type { GeneratedDescription } from "./description-generation";
import type {
  DescriptionGenerationError,
  InvalidGenerationResponseError,
  ModelCatalogError,
  NotFoundError,
  StorageError,
  ValidationError,
} from "../errors";

export interface SenseCandidate {
  name: string;
  definition: string;
}

export interface GenerationDraft {
  senseName: string;
  descriptions: GeneratedDescription[];
}

export type ScreenGenerationFailure =
  | ValidationError
  | NotFoundError
  | ModelCatalogError
  | StorageError
  | DescriptionGenerationError
  | InvalidGenerationResponseError;

export interface ScreenEntryText {
  entryText: string;
  descriptionText: string | null;
  instructionText: string;
}

export interface ScreenDescriptionInput {
  type: DescriptionType;
  text: string;
}
