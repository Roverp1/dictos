import { DbError } from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { DatabaseInUseError } from "./errors";
import {
  CliExitCode,
  type CliContext,
  type CliDependencies,
  type CliProviderDependencies,
} from "./types";

type CliOperationLog = {
  logger: Logger;
  operation: string;
  context?: Context;
};

export const getDependenciesOrExit = async (
  context: CliContext
): Promise<CliDependencies | null> => {
  const dependencies = await context.getDependencies();

  if (dependencies instanceof DatabaseInUseError) {
    context.output.writeError(dependencies.message);
    process.exitCode = CliExitCode.DatabaseInUse;
    return null;
  }

  if (dependencies instanceof Error) {
    context.output.writeError(dependencies.message);
    process.exitCode = CliExitCode.UnexpectedFailure;
    return null;
  }

  return dependencies;
};

export const getProviderDependenciesOrExit = async (
  context: CliContext
): Promise<CliProviderDependencies | null> => {
  const dependencies = await context.getProviderDependencies();
  if (dependencies instanceof Error) {
    context.output.writeError(dependencies.message);
    process.exitCode = CliExitCode.UnexpectedFailure;
    return null;
  }
  return dependencies;
};

export const requireConfirmation = (
  context: CliContext,
  confirmed: boolean | undefined,
  action: string
): boolean => {
  if (confirmed === true) return true;

  context.output.writeError(`${action} requires --yes`);
  process.exitCode = CliExitCode.UsageError;
  return false;
};

export const handleExpectedError = (
  context: CliContext,
  error: Error,
  log?: CliOperationLog
): void => {
  if (log) logOperationFailed({ ...log, error });
  context.output.writeError(error.message);
  process.exitCode = CliExitCode.ExpectedFailure;
};

export const logOperationFailed = ({
  logger,
  operation,
  context,
  error,
  redactDetails = false,
}: CliOperationLog & { error: Error; redactDetails?: boolean }): void => {
  logger.error(
    "CLI operation failed",
    sanitizeLogError({ error, redactDetails }),
    {
      ...context,
      operation,
    }
  );
};

export const logOperationCompleted = ({
  logger,
  operation,
  context,
}: CliOperationLog): void => {
  logger.debug("CLI operation completed", { ...context, operation });
};

export const sanitizeTerminalText = (value: string): string =>
  value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");

function sanitizeLogError({
  error,
  redactDetails = false,
}: {
  error: Error;
  redactDetails?: boolean;
}): Error {
  if (error instanceof DbError)
    return new DbError({
      operation: error.operation,
      reason: "Database operation failed",
      cause: new Error("Database failure details omitted from logs"),
    });
  if (!redactDetails) return error;
  // Parser and provider causes can contain draft text or credentials.
  const sanitized = new Error("Operation failure details omitted from logs");
  sanitized.name = error.name;
  return sanitized;
}
