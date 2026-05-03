import type { Definition, NewDefinition } from "@models/Definition";
import type { DbError } from "errors";

export interface DefinitionRepository {
  save(definition: NewDefinition): Promise<Definition | DbError>;
  findByCapture(captureId: number): Promise<Definition[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Definition, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Definition | DbError>;
  delete(id: number): Promise<Definition | DbError>;
}
