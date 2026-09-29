import { v4 as uuidv4 } from "uuid";

import {
  StorageError,
  type LocalState,
  type LocalStateRepository,
  type SelectedModel,
} from "@dictos/core";
import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";

export class LocalStorageLocalStateRepository implements LocalStateRepository {
  constructor(private logger: Logger) {}

  private read(): LocalState | StorageError | null {
    const data = errore.try(
      () => localStorage.getItem("dictos_local_state"),
      (e) =>
        new StorageError({
          operation: "read_local_state",
          reason: "Exception",
          cause: e,
        })
    );
    if (data instanceof Error) return data;
    if (data === null) return null;

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

  private write(state: LocalState): LocalState | StorageError {
    const res = errore.try(
      () => localStorage.setItem("dictos_local_state", JSON.stringify(state)),
      (e) =>
        new StorageError({
          operation: "write_local_state",
          reason: "Exception",
          cause: e,
        })
    );
    if (res instanceof Error) return res;
    return state;
  }

  async resetLocalState(): Promise<LocalState | StorageError> {
    const state = this.write({ deviceId: uuidv4(), selectedModel: null });
    if (state instanceof Error) return state;
    this.logger.info("Generated new local state");
    return state;
  }

  async getLocalState(): Promise<LocalState | StorageError> {
    const state = this.read();
    if (state instanceof Error) return state;
    if (state !== null) return state;
    return this.resetLocalState();
  }

  async setSelectedModel(
    value: SelectedModel | null
  ): Promise<LocalState | StorageError> {
    const state = this.read();
    if (state instanceof Error) return state;
    return this.write({
      deviceId: state?.deviceId ?? uuidv4(),
      selectedModel: value,
    });
  }
}
