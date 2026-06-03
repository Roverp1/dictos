import type { Folder, NewFolder } from "@models/folder";
import type { DbError } from "errors";

export interface FolderRepository {
  save(folder: NewFolder): Promise<Folder | DbError>;
  findRoot(): Promise<Folder | DbError>;
  findById(id: string): Promise<Folder | DbError | null>;
  findAll(): Promise<Folder[] | DbError>;
  findByParentId(parentId: string): Promise<Folder[] | DbError>;
  update(
    id: string,
    data: Partial<Omit<Folder, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Folder | DbError>;
  delete(id: string): Promise<Folder | DbError>;
}

