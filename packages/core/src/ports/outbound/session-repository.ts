import type { AuthSession } from "@models/user";
import type { DbError } from "errors";

export interface SessionRepository {
  saveSession(session: AuthSession): Promise<void | DbError>;
  getSession(): Promise<AuthSession | DbError | null>;
  clearSession(): Promise<void | DbError>;
}
