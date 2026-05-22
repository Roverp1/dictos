import { create } from "zustand";

import type {
  EntryService,
  FolderService,
  DescriptionService,
} from "@dictos/core";

type ServicesStore = {
  entryService: EntryService | null;
  folderService: FolderService | null;
  descriptionService: DescriptionService | null;

  initServices: (services: Omit<ServicesStore, "initServices">) => void;
};

export const useServicesStore = create<ServicesStore>((set) => ({
  entryService: null,
  folderService: null,
  descriptionService: null,
  initServices: (services) => set(services),
}));

export const useServices = () => {
  const store = useServicesStore();

  if (
    !store.entryService ||
    !store.descriptionService ||
    !store.folderService
  ) {
    throw new Error("Services are not initialized!");
  }

  return {
    entryService: store.entryService,
    descriptionService: store.descriptionService,
    folderService: store.folderService,
  };
};