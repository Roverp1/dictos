import type { DbError } from "../../errors";
import type { NewSense, Sense } from "../../models";

export interface SenseRepository {
  save(input: NewSense): Promise<Sense | DbError>;
  findById(id: string): Promise<Sense | DbError | null>;
  findByEntry(entryId: string): Promise<Sense[] | DbError>;
  update(id: string, input: { name: string }): Promise<Sense | DbError>;
  delete(input: { id: string; cascade: boolean }): Promise<Sense | DbError>;
}
