import type { Description, NewDescription } from "@models/description";
import type { DbError } from "errors";

export interface DescriptionRepository {
  save(description: NewDescription): Promise<Description | DbError>;
  findByEntry(entryId: number): Promise<Description[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Description, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Description | DbError>;
  delete(id: number): Promise<Description | DbError>;
}