import type {
  AuthService,
  DescriptionGenerationService,
  DescriptionService,
  EntryService,
  FolderService,
  InstructionService,
  ModelCatalogPort,
  ModelCatalogService,
  ModelSelectionService,
  ProviderConnectionService,
  SessionRepository,
  SenseService,
  SyncService,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

import type {
  CliDependencyError,
  DatabaseInUseError,
  PromptError,
} from "./errors";

export const CliExitCode = {
  Success: 0,
  UnexpectedFailure: 1,
  UsageError: 2,
  ExpectedFailure: 3,
  DatabaseInUse: 4,
} as const;

export type CliExitCode = (typeof CliExitCode)[keyof typeof CliExitCode];

export type CliProviderDependencies = {
  providerConnectionService: ProviderConnectionService;
  modelCatalogService: ModelCatalogService;
  modelSelectionService: ModelSelectionService;
  modelCatalog: ModelCatalogPort;
  logger: Logger;
};

export type CliDependencies = CliProviderDependencies & {
  entryService: EntryService;
  folderService: FolderService;
  descriptionService: DescriptionService;
  senseService: SenseService;
  instructionService: InstructionService;
  descriptionGenerationService: DescriptionGenerationService;

  authService: AuthService;
  syncService: SyncService;

  sessionRepo: SessionRepository;
};

// probably too complex
// might be worth simplifying all these types
export type CliOutput = {
  writeData(text: string): void;
  writeError(text: string): void;
};

export type TerminalPrompt = {
  readSecret(label: string): Promise<string | PromptError>;
  confirm(label: string): Promise<boolean | PromptError>;
};

export type CliDependencyResult =
  | CliDependencies
  | CliDependencyError
  | DatabaseInUseError;

export type CliProviderDependencyResult =
  | CliProviderDependencies
  | CliDependencyError;

export type CliContext = {
  output: CliOutput;
  terminalPrompt: TerminalPrompt;
  getProviderDependencies(): Promise<CliProviderDependencyResult>;
  getDependencies(): Promise<CliDependencyResult>;
};
