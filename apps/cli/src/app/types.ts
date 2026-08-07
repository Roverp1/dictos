import type {
  AuthService,
  DescriptionService,
  EntryService,
  FolderService,
  SessionRepository,
  SyncService,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

import type {
  CliDependencyError,
  DatabaseInUseError,
  PasswordPromptError,
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

export type PasswordPrompt = {
  readPassword(label: string): Promise<string | PasswordPromptError>;
};

export type CliDependencyResult =
  | CliDependencies
  | CliDependencyError
  | DatabaseInUseError;

export type CliContext = {
  output: CliOutput;
  passwordPrompt: PasswordPrompt;
  getDependencies(): Promise<CliDependencyResult>;
};
