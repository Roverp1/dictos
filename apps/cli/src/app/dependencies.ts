import pino from "pino";
import path from "path";
import * as errore from "@dictos/errore";

import {
  FsLocalStateRepository,
  FsModelCatalogStore,
  FsProviderConnectionRepository,
  FsSessionRepository,
  getDictosDataDir,
} from "@dictos/fs-storage";
import { PinoLoggerAdapter } from "@dictos/pino-logger";

import { CliDependencyError, DatabaseInUseError } from "./errors";
import type {
  CliDependencies,
  CliDependencyResult,
  CliProviderDependencies,
} from "./types";
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
  ModelCatalogAdapter,
} from "@dictos/ai-sdk";
import {
  AuthService,
  DescriptionService,
  DescriptionGenerationService,
  EntryService,
  FolderService,
  InstructionService,
  ModelCatalogService,
  ModelSelectionService,
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

type ProviderGraph = {
  dependencies: CliProviderDependencies;
  dataDir: string;
  localStateRepo: FsLocalStateRepository;
  providerConnectionRepo: FsProviderConnectionRepository;
};

export const createProviderDependencies = async (): Promise<
  ProviderGraph | CliDependencyError
> => {
  const dataDir = await getDictosDataDir();
  if (dataDir instanceof Error)
    return new CliDependencyError({ step: "resolve_data_dir", cause: dataDir });

  const logger = errore.try(
    () =>
      new PinoLoggerAdapter(
        pino(
          { level: "trace" },
          pino.destination({
            dest: path.join(dataDir, "dictos-cli.log"),
            append: true,
          })
        )
      ),
    (cause) => new CliDependencyError({ step: "create_logger", cause })
  );
  if (logger instanceof Error) return logger;

  const localStateRepo = new FsLocalStateRepository(dataDir);
  const providerConnectionRepo = new FsProviderConnectionRepository({
    dataDir,
    logger: logger.child({ adapter: "FsProviderConnectionRepository" }),
  });
  const modelCatalog = new ModelCatalogAdapter({
    store: new FsModelCatalogStore({ dataDir }),
    logger: logger.child({ adapter: "ModelCatalogAdapter" }),
    fetchImplementation: fetch,
  });
  const modelCatalogService = new ModelCatalogService(
    modelCatalog,
    providerConnectionRepo
  );

  return {
    dataDir,
    localStateRepo,
    providerConnectionRepo,
    dependencies: {
      logger,
      modelCatalog,
      modelCatalogService,
      providerConnectionService: new ProviderConnectionService(
        providerConnectionRepo,
        modelCatalogService,
        localStateRepo
      ),
      modelSelectionService: new ModelSelectionService(
        modelCatalogService,
        providerConnectionRepo,
        localStateRepo
      ),
    },
  };
};

export const createCliDependencies = async (
  provider: ProviderGraph
): Promise<CliDependencyResult> => {
  const { dataDir, localStateRepo, providerConnectionRepo } = provider;
  const { logger } = provider.dependencies;
  const localState = await localStateRepo.getLocalState();
  if (localState instanceof Error)
    return new CliDependencyError({
      step: "load_local_state",
      cause: localState,
    });

  const dbClient = await BunTursoClient.create(
    path.join(dataDir, "dictos.db"),
    logger.child({ adapter: "BunTursoClient" })
  ).catch((e) => {
    if (isDatabaseInUseError(e)) return new DatabaseInUseError({ cause: e });

    return new CliDependencyError({ step: "open_database", cause: e });
  });

  if (dbClient instanceof Error) return dbClient;
  configureAiSdkWarningLogging(logger.child({ adapter: "AiSdkWarningLogger" }));

  const db = dbClient.db;

  const entryRepo = new SqliteEntryRepository(db, localState.deviceId);
  const folderRepo = new SqliteFolderRepository(db);
  const descriptionRepo = new SqliteDescriptionRepository(db);
  const senseRepo = new SqliteSenseRepository(db);
  const instructionRepo = new SqliteInstructionRepository(db);
  const descriptionGenerationRepo = new SqliteDescriptionGenerationRepository(
    db
  );
  const userRepo = new SqliteUserRepository(db);
  const sessionRepo = new FsSessionRepository(dataDir);

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488");
  const httpConnectivityAdapter = new HttpConnectivityAdapter(
    "https://turso.tech"
  );

  const syncService = new SyncService(dbClient, httpConnectivityAdapter);

  const dependencies: CliDependencies = {
    ...provider.dependencies,
    entryService: new EntryService(entryRepo),
    folderService: new FolderService(folderRepo),
    descriptionService: new DescriptionService(descriptionRepo, senseRepo),
    senseService: new SenseService(senseRepo),
    instructionService: new InstructionService(instructionRepo),
    descriptionGenerationService: new DescriptionGenerationService(
      descriptionRepo,
      entryRepo,
      instructionRepo,
      providerConnectionRepo,
      provider.dependencies.modelCatalogService,
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
    sessionRepo,
  };

  return dependencies;
};
