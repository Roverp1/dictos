import type { DbError, GenerationConflictError } from "../../errors";
import type {
  DescriptionGenerationProposal,
  DescriptionGenerationResult,
} from "../../models";

export interface DescriptionGenerationRepository {
  commitProposal(
    proposal: DescriptionGenerationProposal
  ): Promise<DescriptionGenerationResult | DbError | GenerationConflictError>;
}
