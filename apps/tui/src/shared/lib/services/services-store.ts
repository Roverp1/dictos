import { create } from "zustand";

import {
  type EntryService,
  type FolderService,
  type DescriptionService,
  AuthService,
} from "@dictos/core";

type ServicesStore = {
  entryService: EntryService | null;
  folderService: FolderService | null;
  descriptionService: DescriptionService | null;
  authService: AuthService | null;

  initServices: (services: Omit<ServicesStore, "initServices">) => void;
};

export const useServicesStore = create<ServicesStore>((set) => ({
  entryService: null,
  folderService: null,
  descriptionService: null,
  authService: null,
  initServices: (services) => set(services),
}));

export const useServices = () => {
  const store = useServicesStore();

  if (
    !store.entryService ||
    !store.descriptionService ||
    !store.folderService ||
    !store.authService
  ) {
    throw new Error("Services are not initialized!");
  }

  return {
    entryService: store.entryService,
    descriptionService: store.descriptionService,
    folderService: store.folderService,
    authService: store.authService,
  };
};
