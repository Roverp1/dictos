import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MemoryRouter } from "react-router-dom";
import pino from "pino";

import {
  SqliteEntryRepository,
  SqliteDescriptionRepository,
  SqliteFolderRepository,
  SqliteUserRepository,
} from "@dictos/db-core";
import { BunTursoClient } from "@dictos/bun-turso-sync";
import {
  FsSessionRepository,
  FsLocalStateRepository,
  getDictosDataDir,
} from "@dictos/fs-storage";
import { CentralApiAdapter, HttpConnectivityAdapter } from "@dictos/eden-http";
import { PinoLoggerAdapter, type PinoLogFormat } from "@dictos/pino-logger";
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
  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 40,
    },
  });

  const pinoStream = {
    write(msg: string) {
      try {
        const obj = JSON.parse(msg) as PinoLogFormat;

        const { level, time, pid, hostname, msg: logMsg, v, ...context } = obj;

        const text = logMsg || msg;
        const hasContext = Object.keys(context).length > 0;

        const args = hasContext ? [text, context] : [text];

        if (obj.level >= 60) console.error(...args);
        else if (obj.level >= 50) console.error(...args);
        else if (obj.level >= 40) console.warn(...args);
        else if (obj.level >= 30) console.info(...args);
        else if (obj.level >= 20) console.debug(...args);
      } catch {
        console.log(msg.trim());
      }
    },
  } as pino.DestinationStream;

  const dataDir = await getDictosDataDir();
  if (dataDir instanceof Error) {
    console.error("Fatal: Cannot create app directory:", dataDir);
    process.exit(1);
  }

  const logFilePath = path.join(dataDir, "dictos.log");
  const fileStream = pino.destination({ dest: logFilePath, append: false });

  const multiStream = pino.multistream([
    { stream: pinoStream },
    { stream: fileStream },
  ]);

  const pinoLogger = pino({ level: "debug" }, multiStream);
  const logger = new PinoLoggerAdapter(pinoLogger);

  const dbClient = await BunTursoClient.create(
    path.join(dataDir, "dictos.db"),
    logger
  );
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
        logger.error("Background sync failed on startup:", e);
      }
    })();
  }

  logger.info("Dictos TUI Bootstrapped Successfully.");

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
