import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import {
  StorageError,
  type LocalState,
  type LocalStateRepository,
  type SelectedModel,
} from "@dictos/core";
import * as errore from "@dictos/errore";

export class FsLocalStateRepository implements LocalStateRepository {
  private readonly localStateFile: string;
  private readonly lockDir: string;

  constructor(dataDir: string) {
    this.localStateFile = path.join(dataDir, "local-state.json");
    this.lockDir = path.join(dataDir, "local-state.json.lock");
  }

  private async locked(
    action: () => Promise<LocalState | StorageError>
  ): Promise<LocalState | StorageError> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const acquired = await fs.mkdir(this.lockDir).catch(
        (cause) =>
          new StorageError({
            operation: "lock_local_state",
            reason: "Exception",
            cause,
          })
      );
      if (!(acquired instanceof Error)) {
        const result = await action();
        const released = await fs.rmdir(this.lockDir).catch(
          (cause) =>
            new StorageError({
              operation: "unlock_local_state",
              reason: "Exception",
              cause,
            })
        );
        if (released instanceof Error) return released;
        return result;
      }
      if ((acquired.cause as NodeJS.ErrnoException).code !== "EEXIST")
        return acquired;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return new StorageError({
      operation: "lock_local_state",
      reason: "Timed out",
    });
  }

  private async read(): Promise<LocalState | StorageError | null> {
    const data = await fs.readFile(this.localStateFile, "utf8").catch(
      (cause) =>
        new StorageError({
          operation: "read_local_state",
          reason: "Exception",
          cause,
        })
    );
    if (data instanceof Error) {
      if ((data.cause as NodeJS.ErrnoException).code === "ENOENT") return null;
      return data;
    }

    const parsed = errore.try(
      () => JSON.parse(data) as unknown,
      () =>
        new StorageError({
          operation: "parse_local_state",
          reason: "Invalid JSON",
        })
    );
    if (parsed instanceof Error) return parsed as StorageError;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("deviceId" in parsed) ||
      typeof parsed.deviceId !== "string" ||
      !parsed.deviceId ||
      ("selectedModel" in parsed &&
        parsed.selectedModel !== null &&
        (typeof parsed.selectedModel !== "object" ||
          !parsed.selectedModel ||
          !("providerId" in parsed.selectedModel) ||
          typeof parsed.selectedModel.providerId !== "string" ||
          !parsed.selectedModel.providerId ||
          !("modelId" in parsed.selectedModel) ||
          typeof parsed.selectedModel.modelId !== "string" ||
          !parsed.selectedModel.modelId))
    )
      return new StorageError({
        operation: "parse_local_state",
        reason: "Invalid state",
      });

    return {
      deviceId: parsed.deviceId,
      selectedModel:
        "selectedModel" in parsed
          ? (parsed.selectedModel as SelectedModel | null)
          : null,
    };
  }

  private async write(state: LocalState): Promise<LocalState | StorageError> {
    const temporary = `${this.localStateFile}.${randomUUID()}.tmp`;
    const written = await fs
      .writeFile(temporary, JSON.stringify(state), { flag: "wx", mode: 0o600 })
      .catch(
        (cause) =>
          new StorageError({
            operation: "write_local_state",
            reason: "Exception",
            cause,
          })
      );
    if (written instanceof Error) {
      const cleaned = await fs.rm(temporary, { force: true }).catch(
        (cause) =>
          new StorageError({
            operation: "write_local_state",
            reason: "Cleanup failed",
            cause,
          })
      );
      return cleaned instanceof Error ? cleaned : written;
    }

    const replaced = await fs.rename(temporary, this.localStateFile).catch(
      (cause) =>
        new StorageError({
          operation: "write_local_state",
          reason: "Exception",
          cause,
        })
    );
    if (replaced instanceof Error) {
      const cleaned = await fs.rm(temporary).catch(
        (cause) =>
          new StorageError({
            operation: "write_local_state",
            reason: "Cleanup failed",
            cause,
          })
      );
      if (cleaned instanceof Error) return cleaned;
      return replaced;
    }
    return state;
  }

  async getLocalState(): Promise<LocalState | StorageError> {
    return this.locked(async () => {
      const state = await this.read();
      if (state instanceof Error) return state;
      if (state !== null) return state;
      return this.write({ deviceId: randomUUID(), selectedModel: null });
    });
  }

  async setSelectedModel(
    value: SelectedModel | null
  ): Promise<LocalState | StorageError> {
    return this.locked(async () => {
      const state = await this.read();
      if (state instanceof Error) return state;
      return this.write({
        deviceId: state?.deviceId ?? randomUUID(),
        selectedModel: value,
      });
    });
  }

  async resetLocalState(): Promise<LocalState | StorageError> {
    return this.locked(() =>
      this.write({ deviceId: randomUUID(), selectedModel: null })
    );
  }
}
