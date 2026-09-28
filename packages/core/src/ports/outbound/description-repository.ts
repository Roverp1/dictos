import type { Description, NewDescription } from "../../models/description";
import type { DbError } from "../../errors";

export interface DescriptionRepository {
  save(input: NewDescription): Promise<Description | DbError>;
  findById(id: string): Promise<Description | DbError | null>;
  findByEntry(entryId: string): Promise<Description[] | DbError>;
  findBySense(senseId: string): Promise<Description[] | DbError>;
  update(
    id: string,
    input: Partial<Pick<Description, "entryId" | "text" | "type">>
  ): Promise<Description | DbError>;
  assignSense(input: {
    descriptionId: string;
    senseId: string | null;
  }): Promise<Description | DbError>;
  delete(id: string): Promise<Description | DbError>;
}
