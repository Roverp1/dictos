import type { NewInstruction, Instruction } from "../../models/instruction";
import type { DbError } from "../../errors";

export interface InstructionRepository {
  save(input: NewInstruction): Promise<Instruction | DbError>;
  findById(id: string): Promise<DbError | Instruction | null>;
  findAll(): Promise<Instruction[] | DbError>;
  update(
    id: string,
    input: { name?: string | null; text?: string }
  ): Promise<Instruction | DbError>;
  delete(id: string): Promise<Instruction | DbError>;
}
