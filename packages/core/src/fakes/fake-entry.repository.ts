import type { EntryRepository } from "../ports/outbound";
import type { Entry, NewEntry } from "../models";
import { DbError } from "../errors";

export class FakeEntryRepository implements EntryRepository {
  public entries = new Map<string, Entry>();

  async save(entry: NewEntry): Promise<Entry | DbError> {
    const newEntry: Entry = {
      ...entry,
      id: Math.random().toString(),
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    this.entries.set(newEntry.id, newEntry);
    return newEntry;
  }

  async findById(id: string): Promise<Entry | DbError | null> {
    return this.entries.get(id) || null;
  }

  async findByFolder(folderId: string): Promise<Entry[] | DbError> {
    return Array.from(this.entries.values()).filter(
      (e) => e.folderId === folderId
    );
  }

  async update(
    id: string,
    data: Partial<Omit<Entry, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Entry | DbError> {
    const existing = this.entries.get(id);
    if (!existing)
      return new DbError({ reason: "Not found", operation: "update" });

    const updated = { ...existing, ...data, modifiedAt: new Date() };
    this.entries.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<Entry | DbError> {
    const existing = this.entries.get(id);
    if (!existing)
      return new DbError({ reason: "Not found", operation: "delete" });

    this.entries.delete(id);
    return existing;
  }
}
