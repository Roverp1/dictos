import type { NewInstruction, Instruction } from "@models/instruction";
import type { DbError } from "errors";

export interface InstructionRepository {
  save(instruction: NewInstruction): Promise<Instruction | DbError>;
  findById(id: string): Promise<DbError | Instruction | null>;
  findAll(): Promise<Instruction[] | DbError>;
  update(
    id: string,
    data: Partial<Omit<Instruction, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Instruction | DbError>;
  delete(id: string): Promise<Instruction | DbError>;
}

