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
  FsLocalStateRepository,
  getDictosDataDir,
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
import path from "path";
import { SqliteUserRepository } from "../../../../packages/adapters/db/repositories/sqlite-user-repository";

export const bootstrap = async () => {
  const dataDir = await getDictosDataDir();
  if (dataDir instanceof Error) {
    console.error("Fatal: Cannot create app directory:", dataDir);
    process.exit(1);
  }

  const dbClient = await BunTursoClient.create(path.join(dataDir, "dictos.db"));
  const db = dbClient.db;

  const localStateRepo = new FsLocalStateRepository(dataDir);
  const localState = await localStateRepo.getLocalState();
  // @todo properly handle errors
  // allow user to try to re-read or re-generate the state
  if (localState instanceof Error) throw localState;

  const entryRepo = new SqliteEntryRepository(db, localState.deviceId);
  const folderRepo = new SqliteFolderRepository(db);
  const descriptionRepo = new SqliteDescriptionRepository(db);
  const userRepo = new SqliteUserRepository(db);
  const sessionRepo = new FsSessionRepository(dataDir);

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488/");

  const entryService = new EntryService(entryRepo);
  const folderService = new FolderService(folderRepo);
  const descriptionService = new DescriptionService(descriptionRepo);
  const authService = new AuthService(centralApiAdapter, sessionRepo, userRepo);
  const syncService = new SyncService(dbClient);

  const sessionResult = await sessionRepo.getSession();
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
