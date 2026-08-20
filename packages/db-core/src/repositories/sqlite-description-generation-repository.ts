import { eq } from "drizzle-orm";
import {
  DbError,
  GenerationConflictError,
  type DescriptionGenerationProposal,
  type DescriptionGenerationRepository,
  type DescriptionGenerationResult,
} from "@dictos/core";
import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

export class SqliteDescriptionGenerationRepository implements DescriptionGenerationRepository {
  constructor(private db: SqliteTursoDrizzleProxy) {}

  async commitProposal(
    proposal: DescriptionGenerationProposal
  ): Promise<DescriptionGenerationResult | DbError | GenerationConflictError> {
    const result = await this.db
      .transaction(async (tx) => {
        const sourceRows = await tx
          .select()
          .from(schema.descriptionsTable)
          .where(eq(schema.descriptionsTable.id, proposal.sourceDescriptionId));
        const source = sourceRows[0];
        if (
          !source ||
          source.entryId !== proposal.entryId ||
          source.senseId !== proposal.expectedSourceSenseId
        )
          return new GenerationConflictError({
            reason: "Source Description changed while generation was running.",
          });
        if (proposal.target.kind === "existing") {
          if (!source.senseId || source.senseId !== proposal.target.senseId)
            return new GenerationConflictError({
              reason:
                "Existing Sense target no longer matches the source Description.",
            });
          const senseRows = await tx
            .select()
            .from(schema.sensesTable)
            .where(eq(schema.sensesTable.id, proposal.target.senseId));
          const sense = senseRows[0];
          if (!sense || sense.entryId !== proposal.entryId)
            return new GenerationConflictError({
              reason: "Existing Sense target is invalid.",
            });
          const inserted = await tx
            .insert(schema.descriptionsTable)
            .values(
              proposal.descriptions.map((description) => ({
                ...description,
                entryId: proposal.entryId,
                senseId: sense.id,
              }))
            )
            .returning();
          return {
            sense,
            sourceDescription: source,
            generatedDescriptions: inserted,
          };
        }
        if (source.senseId !== null)
          return new GenerationConflictError({
            reason: "Source Description is already assigned to a Sense.",
          });
        const created = await tx
          .insert(schema.sensesTable)
          .values({
            entryId: proposal.entryId,
            name: proposal.target.senseName,
          })
          .returning();
        const sense = created[0];
        if (!sense) throw new Error("Sense insert returned no row");
        const assigned = await tx
          .update(schema.descriptionsTable)
          .set({ senseId: sense.id })
          .where(eq(schema.descriptionsTable.id, source.id))
          .returning();
        const sourceDescription = assigned[0];
        if (!sourceDescription)
          throw new Error("Source assignment returned no row");
        const inserted = await tx
          .insert(schema.descriptionsTable)
          .values(
            proposal.descriptions.map((description) => ({
              ...description,
              entryId: proposal.entryId,
              senseId: sense.id,
            }))
          )
          .returning();
        return { sense, sourceDescription, generatedDescriptions: inserted };
      })
      .catch(
        (cause) =>
          new DbError({
            operation: "commit_description_generation",
            reason: "Transaction failed",
            cause,
          })
      );
    return result;
  }
}
