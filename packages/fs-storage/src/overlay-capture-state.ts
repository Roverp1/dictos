import type { DescriptionType, StorageError } from "@dictos/core";

export interface OverlayCaptureLocalState {
  version: 1;
  instructionText: string;
  selectedTypes: DescriptionType[];
}

export interface OverlayCaptureStateStore {
  read(): Promise<OverlayCaptureLocalState | StorageError>;
  replace(
    state: OverlayCaptureLocalState
  ): Promise<OverlayCaptureLocalState | StorageError>;
}

export const emptyOverlayCaptureState = (): OverlayCaptureLocalState => ({
  version: 1,
  instructionText: "",
  selectedTypes: ["definition"],
});
