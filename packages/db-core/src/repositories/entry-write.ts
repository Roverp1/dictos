import { type Entry, type NewEntry, DbError } from "@dictos/core";
import { eq, sql } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

const ENTRY_NAMESPACE = "604605f1-8982-4520-b13a-67b9bc799681";
const ACTIVITY_NAMESPACE = "29450149-2bd6-420b-bb01-a6c36d3e94a5";

export type EntryWriteTransaction = Parameters<
  Parameters<SqliteTursoDrizzleProxy["transaction"]>[0]
>[0];

export function entryIdFor({ text, folderId }: NewEntry): string {
  return uuidv5(`${text}:${folderId}`, ENTRY_NAMESPACE);
}

export function activityIdFor({
  deviceId,
  date,
}: {
  deviceId: string;
  date: string;
}): string {
  return uuidv5(`${date}:${deviceId}`, ACTIVITY_NAMESPACE);
}

export async function insertOrReuseEntry(
  tx: EntryWriteTransaction,
  entry: NewEntry
): Promise<Entry | DbError> {
  const id = entryIdFor(entry);
  const inserted = await tx
    .insert(schema.entriesTable)
    .values({ id, text: entry.text, folderId: entry.folderId })
    .onConflictDoNothing()
    .returning()
    .catch(
      (cause) =>
        new DbError({ operation: "insert_entry", reason: "Exception", cause })
    );
  if (inserted instanceof Error) return inserted;
  if (inserted[0]) return inserted[0];

  const existing = await tx
    .select()
    .from(schema.entriesTable)
    .where(eq(schema.entriesTable.id, id))
    .catch(
      (cause) =>
        new DbError({ operation: "insert_entry", reason: "Exception", cause })
    );
  if (existing instanceof Error) return existing;
  if (!existing[0])
    return new DbError({
      operation: "insert_entry",
      reason: "No row returned",
    });
  return existing[0];
}

export async function incrementEntrySaveActivity(
  tx: EntryWriteTransaction,
  deviceId: string
): Promise<void | DbError> {
  const date = new Date().toISOString().split("T")[0]!;
  const result = await tx
    .insert(schema.activitiesTable)
    .values({ id: activityIdFor({ deviceId, date }), date, count: 1 })
    .onConflictDoUpdate({
      target: schema.activitiesTable.id,
      set: { count: sql`${schema.activitiesTable.count} + 1` },
    })
    .catch(
      (cause) =>
        new DbError({
          operation: "activity_upsert",
          reason: "Exception",
          cause,
        })
    );
  if (result instanceof Error) return result;
}

export async function withEntryWriteTransaction<T>(
  db: SqliteTursoDrizzleProxy,
  operation: string,
  write: (tx: EntryWriteTransaction) => Promise<T | DbError>
): Promise<T | DbError> {
  return db
    .transaction(async (tx) => {
      const result = await write(tx);
      // Returning an Error from a Drizzle callback commits earlier writes.
      if (result instanceof Error) return Promise.reject(result);
      return result;
    })
    .catch((cause) =>
      cause instanceof DbError
        ? cause
        : new DbError({ operation, reason: "Transaction failed", cause })
    );
}
