import { randomUUIDv5 } from "bun";

import {
  type Entry,
  type EntryRepository,
  type NewEntry,
  DbError,
} from "@dictos/core";
import { eq, sql } from "drizzle-orm";

import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

const ENTRY_NAMESPACE = "604605f1-8982-4520-b13a-67b9bc799681";
const ACTIVITY_NAMESPACE = "29450149-2bd6-420b-bb01-a6c36d3e94a5";

export class SqliteEntryRepository implements EntryRepository {
  constructor(
    private db: SqliteTursoDrizzleProxy,
    private deviceId: string
  ) {}

  async save(entry: NewEntry): Promise<Entry | DbError> {
    const entryIdString = `${entry.text}:${entry.folderId}`;
    const entryId = randomUUIDv5(entryIdString, ENTRY_NAMESPACE);

    const savedEntry = await this.db.transaction(async (tx) => {
      const result = await tx
        .insert(schema.entriesTable)
        .values({
          id: entryId,
          text: entry.text,
          folderId: entry.folderId,
        })
        .onConflictDoNothing()
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

      let savedEntry = result[0];
      if (savedEntry === undefined) {
        const existing = await tx
          .select()
          .from(schema.entriesTable)
          .where(eq(schema.entriesTable.id, entryId));

        savedEntry = existing[0];
      }
      if (savedEntry === undefined)
        return new DbError({
          operation: "insert_entry",
          reason: "No row returned",
        });

      const today = new Date().toISOString().split("T")[0]!;
      const deterministicString = `${today}:${this.deviceId}`;
      const activityId = randomUUIDv5(deterministicString, ACTIVITY_NAMESPACE);

      const activityRes = await tx
        .insert(schema.activitiesTable)
        .values({
          id: activityId,
          date: today,
          count: 1,
        })
        .onConflictDoUpdate({
          target: schema.activitiesTable.id,
          set: { count: sql`${schema.activitiesTable.count} + 1` },
        })
        .catch(
          (e) =>
            new DbError({
              operation: "activity_upsert",
              reason: "Exception",
              cause: e,
            })
        );

      if (activityRes instanceof Error) return activityRes;

      return savedEntry;
    });

    return savedEntry;
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
