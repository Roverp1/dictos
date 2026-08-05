import * as errore from "@dictos/errore";

export class CliDependencyError extends errore.createTaggedError({
  name: "CliDependencyError",
  message: "Failed to initialize CLI dependencies during $step",
}) {}

export class DatabaseInUseError extends errore.createTaggedError({
  name: "DatabaseInUseError",
  message: "Dictos database is already open by another process",
}) {}

export class PasswordPromptError extends errore.createTaggedError({
  name: "PasswordPromptError",
  message: "Failed to read password from terminal: $reason",
}) {}
