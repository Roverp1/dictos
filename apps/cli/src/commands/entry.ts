import type { Command } from "commander";

import type { CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
  requireConfirmation,
} from "../app/command-action";

export const registerEntryCommands = (
  program: Command,
  context: CliContext
) => {
  const entry = program.command("entry").description("Manage Entries");

  entry
    .command("create")
    .description("Create an Entry")
    .requiredOption("--folder <folder-id>", "Folder ID")
    .requiredOption("--text <text>", "Entry text")
    .action(async (options: { folder: string; text: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const createdEntry = await dependencies.entryService.createEntry({
        folderId: options.folder,
        text: options.text,
      });

      if (createdEntry instanceof Error)
        return handleExpectedError(context, createdEntry);

      context.output.writeData(createdEntry.id);
    });

  entry
    .command("update")
    .description("Update an Entry")
    .argument("<entry-id>", "Entry ID")
    .requiredOption("--text <text>", "new Entry text")
    .action(async (entryId: string, options: { text: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const updatedEntry = await dependencies.entryService.updateEntry(
        entryId,
        { text: options.text }
      );
      if (updatedEntry instanceof Error)
        return handleExpectedError(context, updatedEntry);
    });

  entry
    .command("delete")
    .description("Delete an Entry")
    .argument("<entry-id>", "Entry ID")
    .option("--yes", "confirm deletion")
    .action(async (entryId: string, options: { yes?: boolean }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const confirmed = requireConfirmation(
        context,
        options.yes,
        "Deleting an Entry"
      );
      if (!confirmed) return;

      const deletedEntry = await dependencies.entryService.deleteEntry(entryId);
      if (deletedEntry instanceof Error)
        return handleExpectedError(context, deletedEntry);
    });

  entry
    .command("list")
    .description("List Entries")
    .requiredOption("--folder <folder-id>", "Folder ID")
    .action(async (options: { folder: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const entries = await dependencies.entryService.getEntriesInFolder(
        options.folder
      );
      if (entries instanceof Error)
        return handleExpectedError(context, entries);

      for (const entry of entries) {
        context.output.writeData(`${entry.id}\t${entry.text}`);
      }
    });
};
