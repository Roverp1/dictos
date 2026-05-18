import type { DbError } from "errors";

export interface OutboxEntry {
  id: number;
  tableName: string;
  recordId: number;
  operation: "INSERT" | "UPDATE" | "DELETE";
  createdAt: Date;
}

export interface OutboxRepository {
  getPending(): Promise<OutboxEntry[] | DbError>;
  deleteEntries(ids: number[]): Promise<void | DbError>;
}
