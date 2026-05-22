import {
  validateNewEntry,
  type Entry,
  type NewEntry,
} from "@models/entry";
import type { EntryRepository } from "@ports/outbound/entry-repository";
import type { DbError, ValidationError } from "errors";

export class EntryService {
  constructor(private repo: EntryRepository) {}

  async createEntry(
    data: NewEntry
  ): Promise<Entry | DbError | ValidationError> {
    const valErr = validateNewEntry(data);
    if (valErr instanceof Error) return valErr;

    const entry = await this.repo.save(data);
    return entry;
  }

  async getEntryById(id: number): Promise<Entry | DbError | null> {
    return await this.repo.findById(id);
  }

  async getEntriesInFolder(
    folderId: number
  ): Promise<Entry[] | DbError> {
    return await this.repo.findByFolder(folderId);
  }

  async updateEntry(
    id: number,
    data: Partial<NewEntry>
  ): Promise<Entry | DbError> {
    /* @todo: validate data later */
    return await this.repo.update(id, data);
  }

  async deleteEntry(id: number): Promise<Entry | DbError> {
    return await this.repo.delete(id);
  }
}