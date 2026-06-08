import type { Entry, NewEntry } from "../../models/entry";
import type { DbError } from "../../errors";

export interface EntryRepository {
  save(entry: NewEntry): Promise<Entry | DbError>;
  findById(id: string): Promise<Entry | DbError | null>;
  findByFolder(folderId: string): Promise<Entry[] | DbError>;
  update(
    id: string,
    data: Partial<Omit<Entry, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Entry | DbError>;
  delete(id: string): Promise<Entry | DbError>;
}
