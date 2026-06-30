import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import pino from "pino";

import {
  SqliteEntryRepository,
  SqliteDescriptionRepository,
  SqliteFolderRepository,
  SqliteUserRepository,
} from "@dictos/db-core";
import { WasmTursoClient } from "@dictos/wasm-turso-sync";
import {
  LocalStorageLocalStateRepository,
  LocalStorageSessionRepository,
} from "@dictos/local-storage";
import { CentralApiAdapter, HttpConnectivityAdapter } from "@dictos/eden-http";
import {
  PinoLoggerAdapter,
  pinoPrettifyBrowser,
  type PinoLogFormat,
} from "@dictos/pino-logger";
import {
  AuthService,
  EntryService,
  DescriptionService,
  FolderService,
  SyncService,
} from "@dictos/core";
import { DictosProvider } from "@dictos/react";

import { App } from "./app";
import type { Journal } from "../../../../packages/wasm-turso-sync/src/migrator";

// If changing relative path - you MUST change it on `journalFiles`
const sqlFiles = import.meta.glob(
  "../../../../packages/db-core/migrations/*.sql",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

const journalFiles = import.meta.glob(
  "../../../../packages/db-core/migrations/meta/_journal.json",
  {
    import: "default",
    eager: true,
  }
);

export const bootstrap = async () => {
  const pinoLogger = pino({
    browser: {
      write: (logObj) => pinoPrettifyBrowser(logObj as PinoLogFormat),
    },
    level: "trace",
  });
  const logger = new PinoLoggerAdapter(pinoLogger);

  const journalKey = Object.keys(journalFiles).find((k) =>
    k.endsWith("_journal.json")
  );
  if (!journalKey)
    throw new Error("Can't find _journal.json in provided files");

  const dbClient = await WasmTursoClient.create(
    "dictos.db",
    logger.child({ adapter: "WasmTursoClient" }),
    { journal: journalFiles[journalKey] as Journal, sqlFiles }
  );
  const db = dbClient.db;

  const localStateRepo = new LocalStorageLocalStateRepository(logger);
  const localState = await localStateRepo.getLocalState();
  // @todo properly handle errors
  // allow user to try to re-read or re-generate the state
  if (localState instanceof Error) throw localState;

  const entryRepo = new SqliteEntryRepository(db, localState.deviceId);
  const folderRepo = new SqliteFolderRepository(db);
  const descriptionRepo = new SqliteDescriptionRepository(db);
  const userRepo = new SqliteUserRepository(db);
  const sessionRepo = new LocalStorageSessionRepository(logger);

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488/");
  const httpConnectivityAdapter = new HttpConnectivityAdapter(
    "https://jsonplaceholder.typicode.com/todos/1"
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

  createRoot(document.getElementById("root")!).render(
    <DictosProvider
      dependencies={{
        entryService,
        folderService,
        descriptionService,
        authService,
        syncService,
        logger,
        notifier: toast,
      }}
    >
      <StrictMode>
        <MemoryRouter initialEntries={["/dictionary"]}>
          <App />
        </MemoryRouter>
      </StrictMode>
    </DictosProvider>
  );
};
