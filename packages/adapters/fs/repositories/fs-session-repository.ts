import fs from "fs/promises";
import path from "path";
import os from "os";
import * as errore from "@dictos/errore";

import {
  StorageError,
  type AuthSession,
  type SessionRepository,
} from "@dictos/core";

import { getAppDataDir } from "fs/paths";

const APP_DATA_DIR = getAppDataDir("dictos");
const SESSION_FILE = path.join(APP_DATA_DIR, "session.json");

export class FsSessionRepository implements SessionRepository {
  async saveSession(session: AuthSession): Promise<void | StorageError> {
    const mkDirResult = await fs.mkdir(APP_DATA_DIR, { recursive: true }).catch(
      (e) =>
        new StorageError({
          operation: "fs_mkdir",
          reason: "Could not create app data dir",
          cause: e,
        })
    );

    if (mkDirResult instanceof Error) return mkDirResult;

    const writeResult = await fs
      .writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8")
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
    const readResult = await fs.readFile(SESSION_FILE, "utf-8").catch((e) => {
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
    const rmResult = await fs.unlink(SESSION_FILE).catch((e) => {
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
