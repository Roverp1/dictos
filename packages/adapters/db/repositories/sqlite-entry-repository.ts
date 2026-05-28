import {
  type Entry,
  type EntryRepository,
  type NewEntry,
  DbError,
} from "@dictos/core";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";

import * as schema from "@db/schema/schema";
import { type TursoDatabase } from "@db/clients";

export class SqliteEntryRepository implements EntryRepository {
  constructor(private db: TursoDatabase) {}

  async save(entry: NewEntry): Promise<Entry | DbError> {
    const result = await this.db
      .insert(schema.entriesTable)
      .values({
        text: entry.text,
        folderId: entry.folderId,
      })
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_entry",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_entry",
        reason: "No row returned",
      });

    return result[0];
  }

  async findById(id: string): Promise<Entry | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.entriesTable)
      .where(eq(schema.entriesTable.id, id))
      .catch(
        (e) =>
          new DbError({
            operation: "find_entry",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0]) return null;

    return result[0];
  }

  async findByFolder(folderId: string): Promise<Entry[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.entriesTable)
      .where(eq(schema.entriesTable.folderId, folderId))
      .catch(
        (e) =>
          new DbError({
            operation: "find_entry_by_dir",
            reason: "Exception",
            cause: e,
          })
      );

    return result;
  }

  async update(
    id: string,
    data: Partial<Omit<Entry, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Entry | DbError> {
    const result = await this.db
      .update(schema.entriesTable)
      .set(data)
      .where(eq(schema.entriesTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "update_entry",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_entry",
        reason: "Entry not found",
      });

    return result[0];
  }

  async delete(id: string): Promise<Entry | DbError> {
    const result = await this.db
      .delete(schema.entriesTable)
      .where(eq(schema.entriesTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "delete_entry",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_entry",
        reason: "Entry not found",
      });

    return result[0];
  }
}
