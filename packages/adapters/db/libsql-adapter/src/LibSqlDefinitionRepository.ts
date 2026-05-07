import {
  DbError,
  type Definition,
  type DefinitionRepository,
  type NewDefinition,
} from "@dictos/core";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "../../schema/schema";
import { eq } from "drizzle-orm";

export class LibSqlDefinitionRepository implements DefinitionRepository {
  constructor(private db: LibSQLDatabase<typeof schema>) {}

  async save(definition: NewDefinition): Promise<Definition | DbError> {
    const result = await this.db
      .insert(schema.definitionsTable)
      .values({
        text: definition.text,
        captureId: definition.captureId,
      })
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_definition",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "insert_definition",
        reason: "No row returned",
      });

    return result[0];
  }

  async findByCapture(captureId: number): Promise<Definition[] | DbError> {
    const result = await this.db
      .select()
      .from(schema.definitionsTable)
      .where(eq(schema.definitionsTable.captureId, captureId))
      .catch(
        (e) =>
          new DbError({
            operation: "find_definition_by_capture_id",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    return result;
  }

  async update(
    id: number,
    data: Partial<Omit<Definition, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Definition | DbError> {
    const result = await this.db
      .update(schema.definitionsTable)
      .set(data)
      .where(eq(schema.definitionsTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "update_definition",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "update_definition",
        reason: "Definition not found",
      });

    return result[0];
  }

  async delete(id: number): Promise<Definition | DbError> {
    const result = await this.db
      .delete(schema.definitionsTable)
      .where(eq(schema.definitionsTable.id, id))
      .returning()
      .catch(
        (e) =>
          new DbError({
            operation: "delete_definition",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result[0])
      return new DbError({
        operation: "delete_definition",
        reason: "Definition not found",
      });

    return result[0];
  }
}
