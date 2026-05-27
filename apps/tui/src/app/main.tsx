import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MemoryRouter } from "react-router-dom";

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

import { useServicesStore } from "@shared/lib/services";

import { App } from "./app";

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
    authService,
  });

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 40,
    },
  });

  createRoot(renderer).render(
    <MemoryRouter initialEntries={["/dictionary"]}>
      <App />
    </MemoryRouter>
  );
};
