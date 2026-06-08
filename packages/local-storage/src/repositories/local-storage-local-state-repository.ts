import { v4 as uuidv4 } from "uuid";

import {
  StorageError,
  type LocalState,
  type LocalStateRepository,
} from "@dictos/core";
import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";

export class LocalStorageLocalStateRepository implements LocalStateRepository {
  constructor(private logger: Logger) {}

  async resetLocalState(): Promise<LocalState | StorageError> {
    const newLocalState = {
      deviceId: uuidv4(),
    } as LocalState;

    this.logger.info("Generated new local state", {
      newLocalState: newLocalState,
    });

    const res = errore.try(
      () =>
        localStorage.setItem(
          "dictos_local_state",
          JSON.stringify(newLocalState)
        ),
      (e) =>
        new StorageError({
          operation: "write_local_state",
          reason: "Exception",
          cause: e,
        })
    );

    if (res instanceof Error) return res;
    return newLocalState;
  }

  async getLocalState(): Promise<LocalState | StorageError> {
    const res = errore.try(
      () => {
        const data = localStorage.getItem("dictos_local_state");
        return data ? (JSON.parse(data) as LocalState) : null;
      },
      (e) =>
        new StorageError({
          operation: "read_local_state",
          reason: "Exception",
          cause: e,
        })
    );

    if (!(res instanceof Error) && res && res.deviceId) return res;

    if (res instanceof Error || (res !== null && !res.deviceId)) {
      this.logger.warn("LocalStorage local state corrupted or invalid", {
        error: res,
      });
    }

    return await this.resetLocalState();
  }
}
