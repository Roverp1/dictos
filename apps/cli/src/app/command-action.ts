import { DatabaseInUseError } from "./errors";
import { CliExitCode, type CliContext, type CliDependencies } from "./types";

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
  error: Error
): void => {
  context.output.writeError(error.message);
  process.exitCode = CliExitCode.ExpectedFailure;
};
