import { eq } from "drizzle-orm";

import {
  DbError,
  type Instruction,
  type InstructionRepository,
  type NewInstruction,
} from "@dictos/core";

import * as schema from "../schema/schema";
import type { SqliteTursoDrizzleProxy } from "./types";

export class SqliteInstructionRepository implements InstructionRepository {
  constructor(private db: SqliteTursoDrizzleProxy) {}

  async save(input: NewInstruction): Promise<Instruction | DbError> {
    const result = await this.db
      .insert(schema.instructionsTable)
      .values({ name: input.name ?? null, text: input.text })
      .returning()
      .catch(
        (cause) =>
          new DbError({
            operation: "insert_instruction",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_instruction",
        reason: "No row returned",
      });
    return result[0];
  }

  async findById(id: string): Promise<Instruction | DbError | null> {
    const result = await this.db
      .select()
      .from(schema.instructionsTable)
      .where(eq(schema.instructionsTable.id, id))
      .catch(
        (cause) =>
          new DbError({
            operation: "find_instruction_by_id",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    return result[0] ?? null;
  }

  async findAll(): Promise<Instruction[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.instructionsTable)
      .catch(
        (cause) =>
          new DbError({
            operation: "find_all_instructions",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    return result;
  }

  async update(
    id: string,
    input: { name?: string | null; text?: string }
  ): Promise<Instruction | DbError> {
    const result = await this.db
      .update(schema.instructionsTable)
      .set(input)
      .where(eq(schema.instructionsTable.id, id))
      .returning()
      .catch(
        (cause) =>
          new DbError({
            operation: "update_instruction",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_instruction",
        reason: "Instruction not found",
      });
    return result[0];
  }

  async delete(id: string): Promise<Instruction | DbError> {
    const result = await this.db
      .delete(schema.instructionsTable)
      .where(eq(schema.instructionsTable.id, id))
      .returning()
      .catch(
        (cause) =>
          new DbError({
            operation: "delete_instruction",
            reason: "Exception",
            cause,
          })
      );
    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_instruction",
        reason: "Instruction not found",
      });
    return result[0];
  }
}
