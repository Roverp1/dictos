import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MemoryRouter } from "react-router-dom";

import {
  BunTursoClient,
  SqliteEntryRepository,
  SqliteDescriptionRepository,
  SqliteFolderRepository,
  FsSessionRepository,
  CentralApiAdapter,
} from "@dictos/adapters";
import {
  AuthService,
  EntryService,
  DescriptionService,
  FolderService,
  SyncService,
  type AuthSession,
} from "@dictos/core";

import { useServicesStore } from "@shared/lib/services";

import { App } from "./app";

export const bootstrap = async () => {
  const dbClient = await BunTursoClient.create("./dictos.db");
  const db = dbClient.db;

  const entryRepo = new SqliteEntryRepository(db);
  const folderRepo = new SqliteFolderRepository(db);
  const descriptionRepository = new SqliteDescriptionRepository(db);
  const sessionRepository = new FsSessionRepository();

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488/");

  const entryService = new EntryService(entryRepo);
  const folderService = new FolderService(folderRepo);
  const descriptionService = new DescriptionService(descriptionRepository);
  const authService = new AuthService(centralApiAdapter, sessionRepository);
  const syncService = new SyncService(dbClient);

  const sessionResult = await sessionRepository.getSession();
  if (sessionResult instanceof Error) {
    console.error(sessionResult);
  }

  const session = sessionResult instanceof Error ? null : sessionResult;

  if (session && session.turso) {
    await syncService.connect(session.turso.url, session.turso.token);
    await syncService.sync();
  }

  useServicesStore.getState().initServices({
    entryService,
    folderService,
    descriptionService,
    authService,
    syncService,
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
