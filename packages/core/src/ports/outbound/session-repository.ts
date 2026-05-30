import type { AuthSession } from "@models/user";
import type { StorageError } from "errors";

export interface SessionRepository {
  saveSession(session: AuthSession): Promise<void | StorageError>;
  getSession(): Promise<AuthSession | StorageError | null>;
  clearSession(): Promise<void | StorageError>;
}
