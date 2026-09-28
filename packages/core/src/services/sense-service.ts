import { type DbError, type ValidationError } from "../errors";
import { type NewSense, type Sense, validateNewSense } from "../models";
import type { SenseRepository } from "../ports/outbound";

export class SenseService {
  constructor(private repo: SenseRepository) {}

  async createSense(
    input: NewSense
  ): Promise<Sense | DbError | ValidationError> {
    const validation = validateNewSense(input);
    if (validation instanceof Error) return validation;
    return await this.repo.save(input);
  }

  async getSenseById(id: string): Promise<Sense | DbError | null> {
    return await this.repo.findById(id);
  }

  async getSensesForEntry(entryId: string): Promise<Sense[] | DbError> {
    return await this.repo.findByEntry(entryId);
  }

  async renameSense(input: {
    id: string;
    name: string;
  }): Promise<Sense | DbError | ValidationError> {
    const validation = validateNewSense({ entryId: "", name: input.name });
    if (validation instanceof Error) return validation;
    return await this.repo.update(input.id, { name: input.name });
  }

  async deleteSense(input: {
    id: string;
    cascade?: boolean;
  }): Promise<Sense | DbError> {
    return await this.repo.delete({
      id: input.id,
      cascade: input.cascade ?? false,
    });
  }
}
