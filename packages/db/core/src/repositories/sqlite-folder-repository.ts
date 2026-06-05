import { eq, isNull } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import {
  DbError,
  type Folder,
  type FolderRepository,
  type NewFolder,
} from "@dictos/core";

import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

const FOLDER_NAMESPACE = "dedc30c7-43ae-4ca3-9779-703ab44bc508";

export class SqliteFolderRepository implements FolderRepository {
  constructor(private db: SqliteTursoDrizzleProxy) {}

  async save(folder: NewFolder): Promise<Folder | DbError> {
    const id = uuidv5(
      `${folder.parentId || "root"}:${folder.name}`,
      FOLDER_NAMESPACE
    );

    const result = await this.db
      .insert(schema.foldersTable)
      .values({ ...folder, id })
      .onConflictDoNothing()
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
    if (!result[0]) {
      const existing = await this.findById(id);
      if (existing instanceof Error) return existing;
      if (!existing)
        return new DbError({
          operation: "insert_folder",
          reason: "Failed to insert and could not find existing folder",
        });

      return existing;
    }

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
    // implemented custom 'ON CASCADE DELETE'
    // remove after turso fixes https://github.com/tursodatabase/turso/issues/5154
    return await this.db.transaction(async (tx) => {
      const targetRes = await tx
        .select()
        .from(schema.foldersTable)
        .where(eq(schema.foldersTable.id, id))
        .catch(
          (e) =>
            new DbError({
              operation: "select_folder",
              reason: "Exception",
              cause: e,
            })
        );

      if (targetRes instanceof Error) return targetRes;
      const targetFolder = targetRes[0];
      if (targetFolder === undefined)
        return new DbError({
          operation: "select_folder",
          reason: "No row returned",
        });

      const idsToDelete: string[] = [];
      const queue: string[] = [id];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        idsToDelete.push(currentId);

        const children = await tx
          .select({ id: schema.foldersTable.id })
          .from(schema.foldersTable)
          .where(eq(schema.foldersTable.parentId, currentId))
          .catch(
            (e) =>
              new DbError({
                operation: "selecet_folder_id",
                reason: "Exception",
                cause: e,
              })
          );

        if (children instanceof Error) return children;

        for (const child of children) {
          queue.push(child.id);
        }
      }

      idsToDelete.reverse();
      for (const folderId of idsToDelete) {
        const res = await tx
          .delete(schema.foldersTable)
          .where(eq(schema.foldersTable.id, folderId))
          .catch(
            (e) =>
              new DbError({
                operation: "delete_folder",
                reason: "Exception",
                cause: e,
              })
          );

        if (res instanceof Error) return res;
      }

      return targetFolder;
    });
  }
}
