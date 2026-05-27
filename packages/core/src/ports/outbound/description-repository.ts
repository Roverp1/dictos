import type { Description, NewDescription } from "@models/description";
import type { DbError } from "errors";

export interface DescriptionRepository {
  save(description: NewDescription): Promise<Description | DbError>;
  findByEntry(entryId: string): Promise<Description[] | DbError>;
  update(
    id: string,
    data: Partial<Omit<Description, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Description | DbError>;
  delete(id: string): Promise<Description | DbError>;
}

