import type { Entry, NewEntry } from "@models/entry";
import type { DbError } from "errors";

export interface EntryRepository {
  save(entry: NewEntry): Promise<Entry | DbError>;
  findById(id: number): Promise<Entry | DbError | null>;
  findByFolder(folderId: number): Promise<Entry[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Entry, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Entry | DbError>;
  delete(id: number): Promise<Entry | DbError>;
}