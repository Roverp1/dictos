import { createContext, useContext, type ReactNode } from "react";

import type {
  EntryService,
  FolderService,
  DescriptionService,
  AuthService,
  SyncService,
} from "@dictos/core";

interface DictosServices {
  entryService: EntryService;
  folderService: FolderService;
  descriptionService: DescriptionService;

  authService: AuthService;
  syncService: SyncService;
}

const DictosContext = createContext<DictosServices | null>(null);

interface DictosProviderProps {
  services: DictosServices;
  children: ReactNode;
}

export const DictosProvider = ({ services, children }: DictosProviderProps) => {
  return (
    <DictosContext.Provider value={services}>{children}</DictosContext.Provider>
  );
};

export const useServices = (): DictosServices => {
  const context = useContext(DictosContext);

  if (!context) {
    throw new Error("useServices must be used within a DictosProvider");
  }

  return context;
};
