import type { Folder, NewFolder } from "@models/folder";
import type { DbError } from "errors";

export interface FolderRepository {
  save(folder: NewFolder): Promise<Folder | DbError>;
  findRoot(): Promise<Folder | DbError>;
  findById(id: number): Promise<Folder | DbError | null>;
  findAll(): Promise<Folder[] | DbError>;
  findByParentId(parentId: number): Promise<Folder[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Folder, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Folder | DbError>;
  delete(id: number): Promise<Folder | DbError>;
}