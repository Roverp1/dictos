import { eq } from "drizzle-orm";

import {
  DbError,
  type Description,
  type DescriptionRepository,
  type NewDescription,
} from "@dictos/core";

import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

export class SqliteDescriptionRepository implements DescriptionRepository {
  constructor(private db: SqliteTursoDrizzleProxy) {}

  async save(description: NewDescription): Promise<Description | DbError> {
    const result = await this.db
      .insert(schema.descriptionsTable)
      .values({
        text: description.text,
        entryId: description.entryId,
        type: description.type ?? "misc",
      })
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_description",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_description",
        reason: "No row returned",
      });

    return result[0];
  }

  async findById(id: string): Promise<Description | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.descriptionsTable)
      .where(eq(schema.descriptionsTable.id, id))
      .catch(
        (cause) =>
          new DbError({
            operation: "find_description_by_id",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    return result[0] ?? null;
  }

  async findByEntry(entryId: string): Promise<Description[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.descriptionsTable)
      .where(eq(schema.descriptionsTable.entryId, entryId))
      .catch(
        (e) =>
          new DbError({
            operation: "find_description_by_entry_id",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    return result;
  }

  async findBySense(senseId: string): Promise<Description[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.descriptionsTable)
      .where(eq(schema.descriptionsTable.senseId, senseId))
      .catch(
        (cause) =>
          new DbError({
            operation: "find_descriptions_by_sense_id",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    return result;
  }

  async update(
    id: string,
    data: Partial<Pick<Description, "entryId" | "text" | "type">>
  ): Promise<Description | DbError> {
    const result = await this.db
      .update(schema.descriptionsTable)
      .set(data)
      .where(eq(schema.descriptionsTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "update_description",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_description",
        reason: "Description not found",
      });

    return result[0];
  }

  async assignSense(input: {
    descriptionId: string;
    senseId: string | null;
  }): Promise<Description | DbError> {
    const result = await this.db
      .update(schema.descriptionsTable)
      .set({ senseId: input.senseId })
      .where(eq(schema.descriptionsTable.id, input.descriptionId))
      .returning()
      .catch(
        (cause) =>
          new DbError({
            operation: "assign_description_sense",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "assign_description_sense",
        reason: "Description not found",
      });
    return result[0];
  }

  async delete(id: string): Promise<Description | DbError> {
    const result = await this.db
      .delete(schema.descriptionsTable)
      .where(eq(schema.descriptionsTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "delete_description",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_description",
        reason: "Description not found",
      });

    return result[0];
  }
}
