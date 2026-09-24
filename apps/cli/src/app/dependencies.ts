import pino from "pino";
import path from "path";

import {
  FsLocalStateRepository,
  FsSessionRepository,
  getDictosDataDir,
} from "@dictos/fs-storage";
import { PinoLoggerAdapter } from "@dictos/pino-logger";

import { CliDependencyError, DatabaseInUseError } from "./errors";
import type { CliDependencies, CliDependencyResult } from "./types";
import { BunTursoClient } from "@dictos/bun-turso-sync";
import {
  SqliteDescriptionRepository,
  SqliteDescriptionGenerationRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteInstructionRepository,
  SqliteSenseRepository,
  SqliteUserRepository,
} from "@dictos/db-core";
import { CentralApiAdapter, HttpConnectivityAdapter } from "@dictos/eden-http";
import {
  AiSdkDescriptionGenerationAdapter,
  configureAiSdkWarningLogging,
  OpenAiCompatibleModelDiscoveryAdapter,
  StaticProviderPresetCatalog,
} from "@dictos/ai-sdk";
import { FsProviderConnectionRepository } from "@dictos/fs-storage";
import {
  AuthService,
  DescriptionService,
  DescriptionGenerationService,
  EntryService,
  FolderService,
  InstructionService,
  ProviderConnectionService,
  SenseService,
  SyncService,
} from "@dictos/core";

const isDatabaseInUseError = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const isLocked =
    message.includes("locking error") ||
    message.includes("file is locked by another process");

  return isLocked;
};

export const createCliDependencies = async (): Promise<CliDependencyResult> => {
  const dataDir = await getDictosDataDir();
  if (dataDir instanceof Error) {
    return new CliDependencyError({ step: "resolve_data_dir", cause: dataDir });
  }

  const logger = new PinoLoggerAdapter(
    pino(
      { level: "trace" },
      pino.destination({
        dest: path.join(dataDir, "dictos-cli.log"),
        append: true,
      })
    )
  );
  configureAiSdkWarningLogging(logger.child({ adapter: "AiSdkWarningLogger" }));

  const dbClient = await BunTursoClient.create(
    path.join(dataDir, "dictos.db"),
    logger.child({ adapter: "BunTursoClient" })
  ).catch((e) => {
    if (isDatabaseInUseError(e)) return new DatabaseInUseError({ cause: e });

    return new CliDependencyError({ step: "open_database", cause: e });
  });

  if (dbClient instanceof Error) return dbClient;

  const localStateRepo = new FsLocalStateRepository(dataDir);
  const localState = await localStateRepo.getLocalState();
  if (localState instanceof Error) {
    return new CliDependencyError({
      step: "load_local_state",
      cause: localState,
    });
  }

  const db = dbClient.db;

  const entryRepo = new SqliteEntryRepository(db, localState.deviceId);
  const folderRepo = new SqliteFolderRepository(db);
  const descriptionRepo = new SqliteDescriptionRepository(db);
  const senseRepo = new SqliteSenseRepository(db);
  const instructionRepo = new SqliteInstructionRepository(db);
  const descriptionGenerationRepo = new SqliteDescriptionGenerationRepository(
    db
  );
  const providerConnectionRepo = new FsProviderConnectionRepository({
    dataDir,
    logger: logger.child({ adapter: "FsProviderConnectionRepository" }),
  });
  const userRepo = new SqliteUserRepository(db);
  const sessionRepo = new FsSessionRepository(dataDir);

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488");
  const httpConnectivityAdapter = new HttpConnectivityAdapter(
    "https://turso.tech"
  );

  const syncService = new SyncService(dbClient, httpConnectivityAdapter);

  const dependencies: CliDependencies = {
    entryService: new EntryService(entryRepo),
    folderService: new FolderService(folderRepo),
    descriptionService: new DescriptionService(descriptionRepo, senseRepo),
    senseService: new SenseService(senseRepo),
    instructionService: new InstructionService(instructionRepo),
    providerConnectionService: new ProviderConnectionService(
      providerConnectionRepo,
      new StaticProviderPresetCatalog(),
      new OpenAiCompatibleModelDiscoveryAdapter({
        logger: logger.child({
          adapter: "OpenAiCompatibleModelDiscoveryAdapter",
        }),
      })
    ),
    descriptionGenerationService: new DescriptionGenerationService(
      descriptionRepo,
      entryRepo,
      instructionRepo,
      providerConnectionRepo,
      senseRepo,
      new AiSdkDescriptionGenerationAdapter({
        logger: logger.child({
          adapter: "AiSdkDescriptionGenerationAdapter",
        }),
      }),
      descriptionGenerationRepo
    ),
    authService: new AuthService(
      centralApiAdapter,
      sessionRepo,
      userRepo,
      syncService
    ),
    syncService,
    logger,

    sessionRepo,
  };

  return dependencies;
};
