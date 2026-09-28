import { ValidationError, type DbError } from "../errors";
import {
  type Instruction,
  type NewInstruction,
  validateNewInstruction,
} from "../models";
import type { InstructionRepository } from "../ports/outbound";

export class InstructionService {
  constructor(private repo: InstructionRepository) {}

  async createInstruction(
    input: NewInstruction
  ): Promise<Instruction | DbError | ValidationError> {
    const validation = validateNewInstruction(input);
    if (validation instanceof Error) return validation;
    return await this.repo.save(input);
  }

  async getInstructionById(id: string): Promise<Instruction | DbError | null> {
    return await this.repo.findById(id);
  }

  async getInstructions(): Promise<Instruction[] | DbError> {
    return await this.repo.findAll();
  }

  async updateInstruction(input: {
    id: string;
    name?: string | null;
    text?: string;
  }): Promise<Instruction | DbError | ValidationError> {
    if (input.name === undefined && input.text === undefined)
      return new ValidationError({ reason: "Instruction update is empty." });
    const validation = validateNewInstruction({
      name: input.name,
      text: input.text ?? "valid",
    });
    if (validation instanceof Error) return validation;
    return await this.repo.update(input.id, {
      name: input.name,
      text: input.text,
    });
  }

  async deleteInstruction(id: string): Promise<Instruction | DbError> {
    return await this.repo.delete(id);
  }
}
