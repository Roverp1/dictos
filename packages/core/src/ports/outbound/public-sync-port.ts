import type { AuthError, DbError } from "errors";
import type { OutboxEntry } from "./outbox-repository";

export interface PublicSyncPort {
  pushActivity(entries: OutboxEntry[]): Promise<void | DbError | AuthError>;
}
