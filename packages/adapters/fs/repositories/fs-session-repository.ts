import fs from "fs/promises";
import path from "path";
import * as errore from "@dictos/errore";

import {
  StorageError,
  type AuthSession,
  type SessionRepository,
} from "@dictos/core";

export class FsSessionRepository implements SessionRepository {
  private localStateFile: string;

  constructor(dataDir: string) {
    this.localStateFile = path.join(dataDir, "session.json");
  }

  async saveSession(session: AuthSession): Promise<void | StorageError> {
    const writeResult = await fs
      .writeFile(this.localStateFile, JSON.stringify(session, null, 2), "utf-8")
      .catch(
        (e) =>
          new StorageError({
            operation: "fs_write",
            reason: "Could not write session file",
            cause: e,
          })
      );

    if (writeResult instanceof Error) return writeResult;
  }

  async getSession(): Promise<AuthSession | StorageError | null> {
    const readResult = await fs
      .readFile(this.localStateFile, "utf-8")
      .catch((e) => {
        const err = e as ErrnoException;
        if (err.code === "ENOENT") return null;

        return new StorageError({
          operation: "fs_read",
          reason: "Could not read session file",
          cause: err,
        });
      });

    if (readResult instanceof Error) return readResult;
    if (readResult === null) return null;

    const parseResult = errore.try(
      () => JSON.parse(readResult) as AuthSession,
      (e) =>
        new StorageError({
          operation: "fs_parse",
          reason: "Corrupted session JSON",
          cause: e,
        })
    );

    if (parseResult instanceof Error) return parseResult;
    return parseResult;
  }

  async clearSession(): Promise<void | StorageError> {
    const rmResult = await fs.unlink(this.localStateFile).catch((e) => {
      const err = e as ErrnoException;
      if (err.code === "ENOENT") return;

      return new StorageError({
        operation: "fs_delete",
        reason: "Could not delete session file",
        cause: e,
      });
    });

    if (rmResult instanceof Error) return rmResult;
  }
}
