import {
  validateNewDefinition,
  type Definition,
  type NewDefinition,
} from "@models/Definition";
import type { DefinitionRepository } from "@ports/outbound";
import type { DbError, ValidationError } from "errors";

export class DefinitionService {
  constructor(private repo: DefinitionRepository) {}

  async createDefinition(
    data: NewDefinition
  ): Promise<Definition | DbError | ValidationError> {
    const valErr = validateNewDefinition(data);
    if (valErr instanceof Error) return valErr;

    const definition = this.repo.save(data);
    return definition;
  }

  async getDefintionsForCapture(
    captureId: number
  ): Promise<Definition[] | DbError | null> {
    return await this.repo.findByCapture(captureId);
  }

  async updateDefinition(
    id: number,
    data: Partial<NewDefinition>
  ): Promise<Definition | DbError> {
    return await this.repo.update(id, data);
  }

  async deleteDefinition(id: number): Promise<Definition | DbError> {
    return await this.repo.delete(id);
  }
}
