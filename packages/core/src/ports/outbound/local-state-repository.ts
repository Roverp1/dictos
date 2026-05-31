import type { StorageError } from "errors";

export interface LocalState {
  deviceId: string;
}

export interface LocalStateRepository {
  getLocalState(): Promise<LocalState | StorageError>;
  resetLocalState(): Promise<LocalState | StorageError>;
}
