import {
  type Capture,
  type CaptureRepository,
  type NewCapture,
  DbError,
} from "@dictos/core";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";

import * as schema from "../../schema/schema";

export class LibSqlCaptureRepository implements CaptureRepository {
  constructor(private db: LibSQLDatabase<typeof schema>) {}

  async save(capture: NewCapture): Promise<Capture | DbError> {
    const result = await this.db
      .insert(schema.capturesTable)
      .values({
        text: capture.text,
        directoryId: capture.directoryId,
      })
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_capture",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_capture",
        reason: "No row returned",
      });

    return result[0];
  }

  async findById(id: number): Promise<Capture | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.capturesTable)
      .where(eq(schema.capturesTable.id, id))
      .catch(
        (e) =>
          new DbError({
            operation: "find_capture",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0]) return null;

    return result[0];
  }

  async findByDirectory(directoryId: number): Promise<Capture[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.capturesTable)
      .where(eq(schema.capturesTable.directoryId, directoryId))
      .catch(
        (e) =>
          new DbError({
            operation: "find_capture_by_dir",
            reason: "Exception",
            cause: e,
          })
      );

    return result;
  }

  async update(
    id: number,
    data: Partial<Omit<Capture, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Capture | DbError> {
    const result = await this.db
      .update(schema.capturesTable)
      .set(data)
      .where(eq(schema.capturesTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "update_capture",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_capture",
        reason: "Capture not found",
      });

    return result[0];
  }

  async delete(id: number): Promise<Capture | DbError> {
    const result = await this.db
      .delete(schema.capturesTable)
      .where(eq(schema.capturesTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "delete_capture",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_capture",
        reason: "Capture not found",
      });

    return result[0];
  }
}
