import * as errore from "@dictos/errore";

export class CliDependencyError extends errore.createTaggedError({
  name: "CliDependencyError",
  message: "Failed to initialize CLI dependencies during $step",
}) {}

export class DatabaseInUseError extends errore.createTaggedError({
  name: "DatabaseInUseError",
  message: "Dictos database is already open by another process",
}) {}

export class PromptError extends errore.createTaggedError({
  name: "PromptError",
  message: "Terminal prompt failed: $reason",
}) {}
