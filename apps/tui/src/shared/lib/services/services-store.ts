import { create } from "zustand";

import type {
  CaptureService,
  DirectoryService,
  DefinitionService,
} from "@dictos/core";

type ServicesStore = {
  captureService: CaptureService | null;
  directoryService: DirectoryService | null;
  definitionService: DefinitionService | null;

  initServices: (services: Omit<ServicesStore, "initServices">) => void;
};

export const useServicesStore = create<ServicesStore>((set) => ({
  captureService: null,
  directoryService: null,
  definitionService: null,
  initServices: (services) => set(services),
}));

export const useServices = () => {
  const store = useServicesStore();

  if (
    !store.captureService ||
    !store.definitionService ||
    !store.directoryService
  ) {
    throw new Error("Services are not initialized!");
  }

  return {
    captureService: store.captureService,
    definitionService: store.definitionService,
    directoryService: store.directoryService,
  };
};
