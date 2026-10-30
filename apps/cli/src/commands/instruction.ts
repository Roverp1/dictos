import type { Command } from "commander";
import { ConfigurationError } from "@dictos/config";
import { configurationFailureResponse } from "../app/configuration-error";
import { ValidationError } from "@dictos/core";
import { CliExitCode, type CliContext } from "../app/types";
import { DatabaseInUseError } from "../app/errors";
import { serializeOverlayJsonResponse } from "../app/overlay-json";
import {
  getConfigurationOrExit,
  getDependenciesOrExit,
  handleExpectedError,
  logOperationCompleted,
  logOperationFailed,
  requireConfirmation,
} from "../app/command-action";

export const registerInstructionCommands = (
  program: Command,
  context: CliContext
) => {
  const instruction = program
    .command("instruction")
    .description("Manage Instructions");
  instruction
    .command("create")
    .requiredOption("--text <text>", "Instruction text")
    .option("--name <name>", "Instruction name")
    .action(async (options: { text: string; name?: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const created =
        await dependencies.instructionService.createInstruction(options);
      if (created instanceof Error)
        return handleExpectedError(context, created, {
          logger: dependencies.logger,
          operation: "instruction.create",
        });
      context.output.writeData(created.id);
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "instruction.create",
        context: { instructionId: created.id, hasName: created.name !== null },
      });
    });
  instruction
    .command("list")
    .option("--json", "Output one JSON envelope")
    .action(async (options: { json?: boolean }) => {
      const dependencies = options.json
        ? await context.getDependencies()
        : await getDependenciesOrExit(context);
      if (dependencies instanceof Error) {
        const databaseInUse = dependencies instanceof DatabaseInUseError;
        context.output.writeData(
          serializeOverlayJsonResponse(
            dependencies,
            databaseInUse ? "DATABASE_IN_USE" : "OPERATION_FAILED"
          ).slice(0, -1)
        );
        context.output.writeError(
          dependencies instanceof ConfigurationError
            ? configurationFailureResponse({ error: dependencies }).error
                .message
            : databaseInUse
              ? "Dictos database is already open by another process"
              : "Operation failed"
        );
        process.exitCode =
          dependencies instanceof ConfigurationError
            ? CliExitCode.ConfigurationFailure
            : databaseInUse
              ? CliExitCode.DatabaseInUse
              : CliExitCode.UnexpectedFailure;
        return;
      }
      if (dependencies === null) return;
      const instructions =
        await dependencies.instructionService.getInstructions();
      if (instructions instanceof Error && options.json) {
        logOperationFailed({
          logger: dependencies.logger,
          operation: "instruction.list",
          error: instructions,
          redactDetails: true,
        });
        context.output.writeData(
          serializeOverlayJsonResponse(instructions).slice(0, -1)
        );
        context.output.writeError("Operation failed");
        process.exitCode = CliExitCode.ExpectedFailure;
        return;
      }
      if (instructions instanceof Error)
        return handleExpectedError(context, instructions, {
          logger: dependencies.logger,
          operation: "instruction.list",
        });
      if (options.json) {
        context.output.writeData(
          serializeOverlayJsonResponse(
            instructions.map(({ id, name, text }) => ({ id, name, text }))
          ).slice(0, -1)
        );
      } else {
        for (const item of instructions)
          context.output.writeData(
            `${item.id}\t${item.name ?? ""}\t${item.text}`
          );
      }
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "instruction.list",
        context: { instructionCount: instructions.length },
      });
    });
  instruction
    .command("update")
    .argument("<instruction-id>", "Instruction ID")
    .option("--text <text>", "Instruction text")
    .option("--name <name>", "Instruction name")
    .option("--clear-name", "Clear Instruction name")
    .action(
      async (
        id: string,
        options: { text?: string; name?: string; clearName?: boolean }
      ) => {
        const configuration = await getConfigurationOrExit(context);
        if (configuration === null) return;
        if (options.name !== undefined && options.clearName)
          return handleExpectedError(
            context,
            new ValidationError({
              reason: "--name and --clear-name cannot be used together.",
            })
          );
        const dependencies = await getDependenciesOrExit(context);
        if (dependencies === null) return;
        const updated = await dependencies.instructionService.updateInstruction(
          {
            id,
            text: options.text,
            name: options.clearName ? null : options.name,
          }
        );
        if (updated instanceof Error)
          return handleExpectedError(context, updated, {
            logger: dependencies.logger,
            operation: "instruction.update",
            context: { instructionId: id },
          });
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "instruction.update",
          context: { instructionId: id, hasName: updated.name !== null },
        });
      }
    );
  instruction
    .command("delete")
    .argument("<instruction-id>", "Instruction ID")
    .option("--yes", "Confirm deletion")
    .action(async (id: string, options: { yes?: boolean }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (
        dependencies === null ||
        !requireConfirmation(context, options.yes, "Deleting an Instruction")
      )
        return;
      const deleted =
        await dependencies.instructionService.deleteInstruction(id);
      if (deleted instanceof Error)
        return handleExpectedError(context, deleted, {
          logger: dependencies.logger,
          operation: "instruction.delete",
          context: { instructionId: id },
        });
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "instruction.delete",
        context: { instructionId: id },
      });
    });
};
