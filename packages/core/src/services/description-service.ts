import {
  validateNewDescription,
  type Description,
  type DescriptionType,
  type NewDescription,
} from "../models/description";
import type { DescriptionRepository, SenseRepository } from "../ports/outbound";
import { NotFoundError, ValidationError, type DbError } from "../errors";

export class DescriptionService {
  constructor(
    private repo: DescriptionRepository,
    private senseRepo: SenseRepository
  ) {}

  async createDescription(
    data: NewDescription
  ): Promise<Description | DbError | ValidationError> {
    const valErr = validateNewDescription(data);
    if (valErr instanceof Error) return valErr;

    const description = this.repo.save(data);
    return description;
  }

  async getDescriptionById(id: string): Promise<Description | DbError | null> {
    return await this.repo.findById(id);
  }

  async getDescriptionsForEntry(
    entryId: string
  ): Promise<Description[] | DbError> {
    return await this.repo.findByEntry(entryId);
  }

  async updateDescription(input: {
    id: string;
    entryId?: string;
    text?: string;
    type?: DescriptionType;
  }): Promise<Description | DbError | ValidationError> {
    if (input.text !== undefined && input.text.trim() === "")
      return new ValidationError({
        reason: "Description text cannot be empty.",
      });

    const description = await this.repo.findById(input.id);
    if (description instanceof Error) return description;
    if (description === null)
      return new ValidationError({ reason: "Description does not exist." });
    if (input.entryId !== undefined && description.senseId !== null)
      return new ValidationError({
        reason: "Detach Description from its Sense before changing its Entry.",
      });

    return await this.repo.update(input.id, {
      entryId: input.entryId,
      text: input.text,
      type: input.type,
    });
  }

  async assignToSense(input: {
    descriptionId: string;
    senseId: string;
  }): Promise<Description | DbError | NotFoundError | ValidationError> {
    const description = await this.repo.findById(input.descriptionId);
    if (description instanceof Error) return description;
    if (description === null)
      return new NotFoundError({
        entity: "Description",
        id: input.descriptionId,
      });

    const sense = await this.senseRepo.findById(input.senseId);
    if (sense instanceof Error) return sense;
    if (sense === null)
      return new NotFoundError({ entity: "Sense", id: input.senseId });
    if (description.entryId !== sense.entryId)
      return new ValidationError({
        reason: "Description and Sense must belong to the same Entry.",
      });

    return await this.repo.assignSense(input);
  }

  async detachFromSense(
    descriptionId: string
  ): Promise<Description | DbError | NotFoundError> {
    const description = await this.repo.findById(descriptionId);
    if (description instanceof Error) return description;
    if (description === null)
      return new NotFoundError({ entity: "Description", id: descriptionId });
    return await this.repo.assignSense({ descriptionId, senseId: null });
  }

  async deleteDescription(id: string): Promise<Description | DbError> {
    return await this.repo.delete(id);
  }
}
