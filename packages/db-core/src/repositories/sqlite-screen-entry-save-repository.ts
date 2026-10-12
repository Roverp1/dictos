import { eq } from "drizzle-orm";
import {
  DbError,
  type ScreenEntrySaveInput,
  type ScreenEntrySaveRepository,
  type ScreenEntrySaveResult,
} from "@dictos/core";

import * as schema from "../schema/schema";
import {
  incrementEntrySaveActivity,
  insertOrReuseEntry,
  withEntryWriteTransaction,
} from "./entry-write";
import type { SqliteTursoDrizzleProxy } from "./types";

export class SqliteScreenEntrySaveRepository implements ScreenEntrySaveRepository {
  constructor(
    private readonly db: SqliteTursoDrizzleProxy,
    private readonly deviceId: string
  ) {}

  async commit(
    input: ScreenEntrySaveInput
  ): Promise<ScreenEntrySaveResult | DbError> {
    return withEntryWriteTransaction(
      this.db,
      "save_reviewed_entry",
      async (tx) => {
        const folders = await tx
          .select()
          .from(schema.foldersTable)
          .where(eq(schema.foldersTable.id, input.folderId));
        if (folders[0]?.parentId !== null || folders[0]?.name !== "/")
          return new DbError({
            operation: "save_reviewed_entry",
            reason: "Root Folder is unavailable.",
          });

        const entry = await insertOrReuseEntry(tx, {
          text: input.entryText,
          folderId: input.folderId,
        });
        if (entry instanceof Error) return entry;
        if (entry.text !== input.entryText || entry.folderId !== input.folderId)
          return new DbError({
            operation: "save_reviewed_entry",
            reason: "An existing Entry changed under this text identity.",
          });

        const createdSense =
          input.kind === "sense"
            ? await tx
                .insert(schema.sensesTable)
                .values({ entryId: entry.id, name: input.senseName })
                .returning()
            : [];
        const sense = createdSense[0] ?? null;
        if (input.kind === "sense" && sense === null)
          return new DbError({
            operation: "save_reviewed_entry",
            reason: "Sense insert returned no row.",
          });

        const descriptionText =
          input.kind === "entry" || input.includeDescription
            ? input.descriptionText
            : null;
        const capturedRows = descriptionText?.trim()
          ? await tx
              .insert(schema.descriptionsTable)
              .values({
                entryId: entry.id,
                senseId: sense?.id ?? null,
                type: "misc",
                text: descriptionText,
              })
              .returning()
          : [];
        const capturedDescription = capturedRows[0] ?? null;
        if (descriptionText?.trim() && capturedDescription === null)
          return new DbError({
            operation: "save_reviewed_entry",
            reason: "Captured Description insert returned no row.",
          });

        const reviewed = input.kind === "sense" ? input.descriptions : [];
        const descriptions = reviewed.length
          ? await tx
              .insert(schema.descriptionsTable)
              .values(
                reviewed.map(({ type, text }) => ({
                  entryId: entry.id,
                  senseId: sense?.id ?? null,
                  type,
                  text,
                }))
              )
              .returning()
          : [];
        if (descriptions.length !== reviewed.length)
          return new DbError({
            operation: "save_reviewed_entry",
            reason: "Reviewed Description insert returned too few rows.",
          });

        const activity = await incrementEntrySaveActivity(tx, this.deviceId);
        if (activity instanceof Error) return activity;

        return { entry, sense, capturedDescription, descriptions };
      }
    );
  }
}
