import type {
  DescriptionType,
  GeneratedDescription,
  GenerationSenseContext,
  ProviderConnectionWithCredential,
} from "../../models";
import type {
  DescriptionGenerationError,
  InvalidGenerationResponseError,
} from "../../errors";

export type DescriptionGenerationRequest = {
  connection: ProviderConnectionWithCredential;
  modelId: string;
  instruction: string;
  entry: { id: string; text: string };
  sourceDescription: {
    id: string;
    text: string;
    type: DescriptionType;
    senseId: string | null;
  };
  targetTypes: DescriptionType[];
  target:
    | { kind: "existing"; sense: GenerationSenseContext }
    | { kind: "new"; existingSenses: GenerationSenseContext[] };
};

export type GeneratedProposal =
  | {
      target: { kind: "existing"; senseId: string };
      descriptions: GeneratedDescription[];
    }
  | {
      target: {
        kind: "new";
        senseName: string;
        duplicateCandidateSenseId: string | null;
      };
      descriptions: GeneratedDescription[];
    };

export interface DescriptionGenerationPort {
  generate(
    request: DescriptionGenerationRequest
  ): Promise<
    | GeneratedProposal
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
}
