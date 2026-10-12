import type {
  DescriptionType,
  GenerationDraft,
  ProviderConnectionWithCredential,
  ScreenDescriptionInput,
  ScreenEntryText,
  SenseCandidate,
} from "../../models";
import type {
  DescriptionGenerationError,
  InvalidGenerationResponseError,
} from "../../errors";

type ScreenEntryGenerationRequest = ScreenEntryText & {
  connection: ProviderConnectionWithCredential;
  modelId: string;
};

export interface ScreenEntryGenerationPort {
  suggestSenses(
    input: ScreenEntryGenerationRequest & { limit: 20 }
  ): Promise<
    | SenseCandidate[]
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
  generateDescriptions(
    input: ScreenEntryGenerationRequest & {
      senseName: string | null;
      existingDescriptions: ScreenDescriptionInput[];
      targetTypes: DescriptionType[];
    }
  ): Promise<
    | GenerationDraft
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
}
