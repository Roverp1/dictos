import * as errore from "@dictos/errore";

import {
  type SessionRepository,
  StorageError,
  type AuthSession,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

export class LocalStorageSessionRepository implements SessionRepository {
  constructor(private logger: Logger) {}

  async saveSession(session: AuthSession): Promise<void | StorageError> {
    const res = errore.try(
      () =>
        localStorage.setItem(
          "dictos_session",
          JSON.stringify(session, null, 2)
        ),
      (e) =>
        new StorageError({
          operation: "local_storage_save",
          reason: "Exception",
          cause: e,
        })
    );

    if (res instanceof Error) return res;

    this.logger.info("Saved user session", { userSession: session });
    return res;
  }

  async getSession(): Promise<AuthSession | StorageError | null> {
    const res = errore.try(
      () => {
        const session = localStorage.getItem("dictos_session");
        return session ? (JSON.parse(session) as AuthSession) : null;
      },
      (e) =>
        new StorageError({
          operation: "local_storage_read",
          reason: "Exception",
          cause: e,
        })
    );

    return res;
  }

  async clearSession(): Promise<void | StorageError> {
    const res = errore.try(
      () => localStorage.removeItem("dictos_session"),
      (e) =>
        new StorageError({
          operation: "local_storage_delete",
          reason: "Exception",
          cause: e,
        })
    );

    if (res instanceof Error) return res;

    this.logger.info("Cleared user session");
  }
}
