import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

import {
  StorageError,
  type LocalState,
  type LocalStateRepository,
} from "@dictos/core";
import * as errore from "@dictos/errore";

export class FsLocalStateRepository implements LocalStateRepository {
  private localStateFile: string;

  constructor(dataDir: string) {
    this.localStateFile = path.join(dataDir, "local-state.json");
  }

  async resetLocalState(): Promise<LocalState | StorageError> {
    const newLocalState = {
      deviceId: randomUUID(),
    } as LocalState;

    const writeRes = await fs
      .writeFile(this.localStateFile, JSON.stringify(newLocalState), "utf-8")
      .catch(
        (e) =>
          new StorageError({
            operation: "write_local_state",
            reason: "Exception",
            cause: e,
          })
      );

    if (writeRes instanceof Error) return writeRes;
    return newLocalState;
  }

  async getLocalState(): Promise<LocalState | StorageError> {
    const data = await fs.readFile(this.localStateFile, "utf-8").catch((e) => {
      const err = e as ErrnoException;
      if (err.code === "ENOENT") return null;
      return new StorageError({
        operation: "read_local_state",
        reason: "Exception",
        cause: e,
      });
    });

    if (data instanceof Error) return data;

    if (data !== null) {
      const state = errore.try(
        () => JSON.parse(data) as LocalState,
        (e) =>
          new StorageError({
            operation: "parse_local_state",
            reason: "Exception",
            cause: e,
          })
      );

      if (!(state instanceof Error) && state.deviceId) return state;
      else console.warn("Failed to read local state:", state);
    }

    return await this.resetLocalState();
  }
}
