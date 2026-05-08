import type { Directory, NewDirectory } from "@models/Directory";
import type { DbError } from "errors";

export interface DirectoryRepository {
  save(directory: NewDirectory): Promise<Directory | DbError>;
  findRoot(): Promise<Directory | DbError>;
  findById(id: number): Promise<Directory | DbError | null>;
  findAll(): Promise<Directory[] | DbError>;
  findByParentId(parentId: number): Promise<Directory[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Directory, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Directory | DbError>;
  delete(id: number): Promise<Directory | DbError>;
}
