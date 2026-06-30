/** @jsxImportSource react */
import { createContext, useContext, type ReactNode } from "react";

import type {
  EntryService,
  FolderService,
  DescriptionService,
  AuthService,
  SyncService,
} from "@dictos/core";
import { type Logger } from "@dictos/logger";

interface Notifier {
  error: (message: string, options?: { description?: string }) => void;
}

interface DictosDependencies {
  entryService: EntryService;
  folderService: FolderService;
  descriptionService: DescriptionService;

  authService: AuthService;
  syncService: SyncService;

  logger: Logger;
  notifier: Notifier;
}

const DependenciesContext = createContext<DictosDependencies | null>(null);

interface DictosProviderProps {
  dependencies: DictosDependencies;
  children: ReactNode;
}

export const DictosProvider = ({
  dependencies,
  children,
}: DictosProviderProps) => {
  return (
    <DependenciesContext.Provider value={dependencies}>
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
