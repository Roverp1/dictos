import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  DbError,
  type Directory,
  type DirectoryRepository,
  type NewDirectory,
} from "@dictos/core";

import * as schema from "../../schema/schema";
import { eq, isNull } from "drizzle-orm";

export class LibSqlDirectoryRepository implements DirectoryRepository {
  constructor(private db: LibSQLDatabase<typeof schema>) {}

  async save(directory: NewDirectory): Promise<Directory | DbError> {
    const result = await this.db
      .insert(schema.directoriesTable)
      .values(directory)
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_directory",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_directory",
        reason: "No row returned",
      });

    return result[0];
  }

  async findRoot(): Promise<Directory | DbError> {
    const result = await this.db
      .select()
      .from(schema.directoriesTable)
      .where(isNull(schema.directoriesTable.parentId))
      .catch(
        (e) =>
          new DbError({
            operation: "select_root_directory",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    return result[0]!;
  }

  async findById(id: number): Promise<Directory | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.directoriesTable)
      .where(eq(schema.directoriesTable.id, id))
      .catch(
        (e) =>
          new DbError({
            operation: "select_directory_by_id",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0]) return null;

    return result[0];
  }

  async findByParentId(parentId: number): Promise<Directory[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.directoriesTable)
      .where(eq(schema.directoriesTable.parentId, parentId))
      .catch(
        (e) =>
          new DbError({
            operation: "select_directory_by_parent_id",
            reason: "Exception",
            cause: e,
          })
      );

    return result;
  }

  async findAll(): Promise<Directory[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.directoriesTable)
      .catch(
        (e) =>
          new DbError({
            operation: "select_all_directories",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    return result;
  }

  async update(
    id: number,
    data: Partial<Omit<Directory, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Directory | DbError> {
    const result = await this.db
      .update(schema.directoriesTable)
      .set(data)
      .where(eq(schema.directoriesTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "update_directory",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_directory",
        reason: "No row returned",
      });

    return result[0];
  }

  async delete(id: number): Promise<Directory | DbError> {
    const result = await this.db
      .delete(schema.directoriesTable)
      .where(eq(schema.directoriesTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "delete_directory",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_directory",
        reason: "No row returned",
      });

    return result[0];
  }
}
