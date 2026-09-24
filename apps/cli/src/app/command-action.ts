import { DbError } from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { DatabaseInUseError } from "./errors";
import { CliExitCode, type CliContext, type CliDependencies } from "./types";

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
  if (log)
    log.logger.error("CLI operation failed", sanitizeLogError(error), {
      ...log.context,
      operation: log.operation,
    });
  context.output.writeError(error.message);
  process.exitCode = CliExitCode.ExpectedFailure;
};

export const logOperationCompleted = ({
  logger,
  operation,
  context,
}: CliOperationLog): void => {
  logger.debug("CLI operation completed", { ...context, operation });
};

function sanitizeLogError(error: Error): Error {
  if (!(error instanceof DbError)) return error;
  return new DbError({
    operation: error.operation,
    reason: "Database operation failed",
    cause: new Error("Database failure details omitted from logs"),
  });
}
