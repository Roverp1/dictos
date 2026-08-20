import type { Command } from "commander";
import type { CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
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
        return handleExpectedError(context, created);
      context.output.writeData(created.id);
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
      if (senses instanceof Error) return handleExpectedError(context, senses);
      for (const item of senses)
        context.output.writeData(`${item.id}\t${item.name}`);
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
        return handleExpectedError(context, updated);
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
          return handleExpectedError(context, deleted);
      }
    );
};
