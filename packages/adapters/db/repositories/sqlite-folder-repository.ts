import { eq, isNull } from "drizzle-orm";

import {
  DbError,
  type Folder,
  type FolderRepository,
  type NewFolder,
} from "@dictos/core";

import * as schema from "@db/schema/schema";
import { type TursoDatabase } from "@db/clients";
import { genFolderUUIDV5 } from "db/uuid";

export class SqliteFolderRepository implements FolderRepository {
  constructor(private db: TursoDatabase) {}

  async save(folder: NewFolder): Promise<Folder | DbError> {
    const id = genFolderUUIDV5(`${folder.parentId || "root"}:${folder.name}`);

    const result = await this.db
      .insert(schema.foldersTable)
      .values({ ...folder, id })
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_folder",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_folder",
        reason: "No row returned",
      });

    return result[0];
  }

  async findRoot(): Promise<Folder | DbError> {
    const result = await this.db
      .select()
      .from(schema.foldersTable)
      .where(isNull(schema.foldersTable.parentId))
      .catch(
        (e) =>
          new DbError({
            operation: "select_root_folder",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    return result[0]!;
  }

  async findById(id: string): Promise<Folder | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.foldersTable)
      .where(eq(schema.foldersTable.id, id))
      .catch(
        (e) =>
          new DbError({
            operation: "select_folder_by_id",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0]) return null;

    return result[0];
  }

  async findByParentId(parentId: string): Promise<Folder[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.foldersTable)
      .where(eq(schema.foldersTable.parentId, parentId))
      .catch(
        (e) =>
          new DbError({
            operation: "select_folder_by_parent_id",
            reason: "Exception",
            cause: e,
          })
      );

    return result;
  }

  async findAll(): Promise<Folder[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.foldersTable)
      .catch(
        (e) =>
          new DbError({
            operation: "select_all_folders",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    return result;
  }

  async update(
    id: string,
    data: Partial<Omit<Folder, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Folder | DbError> {
    const result = await this.db
      .update(schema.foldersTable)
      .set(data)
      .where(eq(schema.foldersTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "update_folder",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_folder",
        reason: "No row returned",
      });

    return result[0];
  }

  async delete(id: string): Promise<Folder | DbError> {
    const result = await this.db
      .delete(schema.foldersTable)
      .where(eq(schema.foldersTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "delete_folder",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_folder",
        reason: "No row returned",
      });

    return result[0];
  }
}
