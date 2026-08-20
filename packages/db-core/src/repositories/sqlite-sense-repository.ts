import { eq } from "drizzle-orm";

import {
  DbError,
  type NewSense,
  type Sense,
  type SenseRepository,
} from "@dictos/core";

import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

export class SqliteSenseRepository implements SenseRepository {
  constructor(private db: SqliteTursoDrizzleProxy) {}

  async save(input: NewSense): Promise<Sense | DbError> {
    const result = await this.db
      .insert(schema.sensesTable)
      .values(input)
      .returning()
      .catch(
        (cause) =>
          new DbError({ operation: "insert_sense", reason: "Exception", cause })
      );
    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_sense",
        reason: "No row returned",
      });
    return result[0];
  }

  async findById(id: string): Promise<Sense | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.sensesTable)
      .where(eq(schema.sensesTable.id, id))
      .catch(
        (cause) =>
          new DbError({
            operation: "find_sense_by_id",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    return result[0] ?? null;
  }

  async findByEntry(entryId: string): Promise<Sense[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.sensesTable)
      .where(eq(schema.sensesTable.entryId, entryId))
      .catch(
        (cause) =>
          new DbError({
            operation: "find_senses_by_entry",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    return result;
  }

  async update(id: string, input: { name: string }): Promise<Sense | DbError> {
    const result = await this.db
      .update(schema.sensesTable)
      .set(input)
      .where(eq(schema.sensesTable.id, id))
      .returning()
      .catch(
        (cause) =>
          new DbError({ operation: "update_sense", reason: "Exception", cause })
      );
    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_sense",
        reason: "Sense not found",
      });
    return result[0];
  }

  async delete(input: {
    id: string;
    cascade: boolean;
  }): Promise<Sense | DbError> {
    const result = await this.db
      .transaction(async (tx) => {
        const selected = await tx
          .select()
          .from(schema.sensesTable)
          .where(eq(schema.sensesTable.id, input.id));
        const sense = selected[0];
        if (!sense) throw new Error("Sense not found");

        if (input.cascade)
          await tx
            .delete(schema.descriptionsTable)
            .where(eq(schema.descriptionsTable.senseId, input.id));
        const deleted = await tx
          .delete(schema.sensesTable)
          .where(eq(schema.sensesTable.id, input.id))
          .returning();
        if (!deleted[0]) throw new Error("Sense not found");
        return deleted[0];
      })
      .catch(
        (cause) =>
          new DbError({ operation: "delete_sense", reason: "Exception", cause })
      );
    if (result instanceof Error) return result;
    return result;
  }
}
