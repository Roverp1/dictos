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

  async update(
    id: string,
    data: Partial<Omit<Description, "id" | "createdAt" | "modifiedAt">>
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
