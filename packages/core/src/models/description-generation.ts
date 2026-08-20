import type { DescriptionType } from "./description";
import type { Sense } from "./sense";

export interface GeneratedDescription {
  type: DescriptionType;
  text: string;
}

export interface GenerationSenseContext {
  id: string;
  name: string;
  descriptions: GeneratedDescription[];
}

export type DescriptionGenerationTarget =
  | { kind: "existing"; senseId: string }
  | {
      kind: "new";
      senseName: string;
      duplicateCandidateSenseId: string | null;
    };

export interface DescriptionGenerationProposal {
  entryId: string;
  sourceDescriptionId: string;
  expectedSourceSenseId: string | null;
  target: DescriptionGenerationTarget;
  descriptions: GeneratedDescription[];
}

export interface DescriptionGenerationResult {
  sense: Sense;
  sourceDescription: import("./description").Description;
  generatedDescriptions: import("./description").Description[];
}
