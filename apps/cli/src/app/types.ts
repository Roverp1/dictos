import type {
  AuthService,
  DescriptionGenerationService,
  DescriptionService,
  EntryService,
  FolderService,
  InstructionService,
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

export type CliDependencies = {
  entryService: EntryService;
  folderService: FolderService;
  descriptionService: DescriptionService;
  senseService: SenseService;
  instructionService: InstructionService;
  providerConnectionService: ProviderConnectionService;
  descriptionGenerationService: DescriptionGenerationService;

  authService: AuthService;
  syncService: SyncService;

  logger: Logger;

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

export type CliContext = {
  output: CliOutput;
  terminalPrompt: TerminalPrompt;
  getDependencies(): Promise<CliDependencyResult>;
};
