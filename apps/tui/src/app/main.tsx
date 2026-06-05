import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MemoryRouter } from "react-router-dom";

import {
  SqliteEntryRepository,
  SqliteDescriptionRepository,
  SqliteFolderRepository,
  SqliteUserRepository,
} from "../../../../packages/db/core/src";
import { BunTursoClient } from "@dictos/bun-turso-sync";
import {
  FsSessionRepository,
  FsLocalStateRepository,
  getDictosDataDir,
} from "@dictos/fs-storage";
import { CentralApiAdapter, HttpConnectivityAdapter } from "@dictos/eden-http";
import { PinoLoggerAdapter } from "@dictos/pino-logger";
import {
  AuthService,
  EntryService,
  DescriptionService,
  FolderService,
  SyncService,
  type AuthSession,
} from "@dictos/core";
import { DictosProvider } from "@dictos/react";

import { App } from "./app";
import path from "path";

export const bootstrap = async () => {
  const dataDir = await getDictosDataDir();
  if (dataDir instanceof Error) {
    console.error("Fatal: Cannot create app directory:", dataDir);
    process.exit(1);
  }

  const logFilePath = path.join(dataDir, `dictos-debug.log`);
  const logger = new PinoLoggerAdapter(logFilePath);

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
  const httpConnectivityAdapter = new HttpConnectivityAdapter(
    "https://turso.tech/"
  );

  const entryService = new EntryService(entryRepo);
  const folderService = new FolderService(folderRepo);
  const descriptionService = new DescriptionService(descriptionRepo);
  const syncService = new SyncService(dbClient, httpConnectivityAdapter);
  const authService = new AuthService(
    centralApiAdapter,
    sessionRepo,
    userRepo,
    syncService
  );

  const sessionResult = await sessionRepo.getSession();
  if (sessionResult instanceof Error) {
    console.error(sessionResult);
  }

  const session = sessionResult instanceof Error ? null : sessionResult;

  if (session && session.turso) {
    (async () => {
      try {
        await syncService.connect(session.turso!.url, session.turso!.token);
        const result = await syncService.sync();

        if (!(result instanceof Error) && result.pulledRemoteChanges) {
        } // refresh ui or smth
      } catch (e) {
        console.error("Background sync failed on startup:", e);
      }
    })();
  }

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 40,
    },
  });

  createRoot(renderer).render(
    <DictosProvider
      dependencies={{
        entryService,
        folderService,
        descriptionService,
        authService,
        syncService,
        logger,
      }}
    >
      <MemoryRouter initialEntries={["/dictionary"]}>
        <App />
      </MemoryRouter>
    </DictosProvider>
  );
};
