import type { DbError } from "../../errors";

export interface OutboxEntry {
  id: string;
  tableName: string;
  recordId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  createdAt: Date;
}

export interface OutboxRepository {
  getPending(): Promise<OutboxEntry[] | DbError>;
  deleteEntries(ids: string[]): Promise<void | DbError>;
}
