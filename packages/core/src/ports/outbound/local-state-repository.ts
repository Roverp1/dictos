import type { StorageError } from "../../errors";
import type { SelectedModel } from "../../models";

export interface LocalState {
  deviceId: string;
  selectedModel: SelectedModel | null;
}

export interface LocalStateRepository {
  getLocalState(): Promise<LocalState | StorageError>;
  resetLocalState(): Promise<LocalState | StorageError>;
  // Selection updates preserve the device ID; only reset changes it.
  setSelectedModel(
    value: SelectedModel | null
  ): Promise<LocalState | StorageError>;
}
