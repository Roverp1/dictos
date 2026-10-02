import {
  type Entry,
  type EntryRepository,
  type NewEntry,
  DbError,
} from "@dictos/core";
import { eq } from "drizzle-orm";

import * as schema from "../schema/schema";
import {
  incrementEntrySaveActivity,
  insertOrReuseEntry,
  withEntryWriteTransaction,
} from "./entry-write";
import type { SqliteTursoDrizzleProxy } from "./types";

export class SqliteEntryRepository implements EntryRepository {
  constructor(
    private db: SqliteTursoDrizzleProxy,
    private deviceId: string
  ) {}

  async save(entry: NewEntry): Promise<Entry | DbError> {
    return withEntryWriteTransaction(this.db, "save_entry", async (tx) => {
      const savedEntry = await insertOrReuseEntry(tx, entry);
      if (savedEntry instanceof Error) return savedEntry;

      const activity = await incrementEntrySaveActivity(tx, this.deviceId);
      if (activity instanceof Error) return activity;

      return savedEntry;
    });
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
