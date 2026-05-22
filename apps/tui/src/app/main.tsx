import { useState } from "react";
import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import {
  createLibSqlDatabase,
  LibSqlEntryRepository,
  LibSqlDescriptionRepository,
  LibSqlFolderRepository,
  LibSqlSessionRepository,
  CentralApiAdapter,
} from "@dictos/adapters";
import {
  AuthService,
  EntryService,
  DescriptionService,
  FolderService,
} from "@dictos/core";

import { DictionaryPage } from "@pages/dictionary";
import { AuthPage } from "@pages/auth";
import { useServicesStore } from "@shared/lib/services";

export const bootstrap = async () => {
  const db = await createLibSqlDatabase("file:./dictos.db");

  const entryRepo = new LibSqlEntryRepository(db);
  const folderRepo = new LibSqlFolderRepository(db);
  const descriptionRepository = new LibSqlDescriptionRepository(db);
  const sessionRepository = new LibSqlSessionRepository(db);

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488/");

  const entryService = new EntryService(entryRepo);
  const folderService = new FolderService(folderRepo);
  const descriptionService = new DescriptionService(descriptionRepository);
  const authService = new AuthService(centralApiAdapter, sessionRepository);

  useServicesStore.getState().initServices({
    entryService,
    folderService,
    descriptionService,
  });

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 40,
    },
  });

  createRoot(renderer).render(<App authService={authService} />);
};

export type Route = "auth" | "dictionary";

interface Props {
  authService: AuthService;
}

function App({ authService }: Props) {
  const [route, setRoute] = useState<Route>("auth");

  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "f12") {
      renderer.console.toggle();
    }

    if (key.shift && key.name === "tab") {
      setRoute((prev) => (prev === "auth" ? "dictionary" : "auth"));
    }
  });

  if (route === "auth") return <AuthPage authService={authService} />;

  return <DictionaryPage />;
}