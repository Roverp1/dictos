import type { Command } from "commander";
import type { CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
  logOperationCompleted,
  requireConfirmation,
} from "../app/command-action";

export const registerSenseCommands = (
  program: Command,
  context: CliContext
) => {
  const sense = program.command("sense").description("Manage Senses");
  sense
    .command("create")
    .requiredOption("--entry <entry-id>", "Entry ID")
    .requiredOption("--name <name>", "Sense name")
    .action(async (options: { entry: string; name: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const created = await dependencies.senseService.createSense({
        entryId: options.entry,
        name: options.name,
      });
      if (created instanceof Error)
        return handleExpectedError(context, created, {
          logger: dependencies.logger,
          operation: "sense.create",
          context: { entryId: options.entry },
        });
      context.output.writeData(created.id);
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "sense.create",
        context: { senseId: created.id, entryId: created.entryId },
      });
    });
  sense
    .command("list")
    .requiredOption("--entry <entry-id>", "Entry ID")
    .action(async (options: { entry: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const senses = await dependencies.senseService.getSensesForEntry(
        options.entry
      );
      if (senses instanceof Error)
        return handleExpectedError(context, senses, {
          logger: dependencies.logger,
          operation: "sense.list",
          context: { entryId: options.entry },
        });
      for (const item of senses)
        context.output.writeData(`${item.id}\t${item.name}`);
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "sense.list",
        context: { entryId: options.entry, senseCount: senses.length },
      });
    });
  sense
    .command("update")
    .argument("<sense-id>", "Sense ID")
    .requiredOption("--name <name>", "Sense name")
    .action(async (id: string, options: { name: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const updated = await dependencies.senseService.renameSense({
        id,
        name: options.name,
      });
      if (updated instanceof Error)
        return handleExpectedError(context, updated, {
          logger: dependencies.logger,
          operation: "sense.update",
          context: { senseId: id },
        });
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "sense.update",
        context: { senseId: id, entryId: updated.entryId },
      });
    });
  sense
    .command("delete")
    .argument("<sense-id>", "Sense ID")
    .option("--yes", "Confirm deletion")
    .option("--cascade", "Delete assigned Descriptions")
    .action(
      async (id: string, options: { yes?: boolean; cascade?: boolean }) => {
        const dependencies = await getDependenciesOrExit(context);
        if (
          dependencies === null ||
          !requireConfirmation(context, options.yes, "Deleting a Sense")
        )
          return;
        const deleted = await dependencies.senseService.deleteSense({
          id,
          cascade: options.cascade,
        });
        if (deleted instanceof Error)
          return handleExpectedError(context, deleted, {
            logger: dependencies.logger,
            operation: "sense.delete",
            context: { senseId: id, cascade: options.cascade === true },
          });
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "sense.delete",
          context: { senseId: id, cascade: options.cascade === true },
        });
      }
    );
};
