import {
  validateNewDescription,
  type Description,
  type NewDescription,
} from "@models/description";
import type { DescriptionRepository } from "@ports/outbound";
import type { DbError, ValidationError } from "errors";

export class DescriptionService {
  constructor(private repo: DescriptionRepository) {}

  async createDescription(
    data: NewDescription
  ): Promise<Description | DbError | ValidationError> {
    const valErr = validateNewDescription(data);
    if (valErr instanceof Error) return valErr;

    const description = this.repo.save(data);
    return description;
  }

  async getDescriptionsForEntry(
    entryId: string
  ): Promise<Description[] | DbError> {
    return await this.repo.findByEntry(entryId);
  }

  async updateDescription(
    id: string,
    data: Partial<NewDescription>
  ): Promise<Description | DbError> {
    return await this.repo.update(id, data);
  }

  async deleteDescription(id: string): Promise<Description | DbError> {
    return await this.repo.delete(id);
  }
}

