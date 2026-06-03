import { createContext, useContext, type ReactNode } from "react";

import type {
  EntryService,
  FolderService,
  DescriptionService,
  AuthService,
  SyncService,
} from "@dictos/core";
import { type Logger } from "@dictos/logger";

interface DictosDependencies {
  entryService: EntryService;
  folderService: FolderService;
  descriptionService: DescriptionService;

  authService: AuthService;
  syncService: SyncService;

  logger: Logger;
}

const DependenciesContext = createContext<DictosDependencies | null>(null);

interface DictosProviderProps {
  services: DictosDependencies;
  children: ReactNode;
}

export const DictosProvider = ({ services, children }: DictosProviderProps) => {
  return (
    <DependenciesContext.Provider value={services}>
      {children}
    </DependenciesContext.Provider>
  );
};

export const useDependencies = (): DictosDependencies => {
  const context = useContext(DependenciesContext);

  if (!context) {
    throw new Error("useServices must be used within a DictosProvider");
  }

  return context;
};
