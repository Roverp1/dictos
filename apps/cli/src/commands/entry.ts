import type { Command } from "commander";

import type { CliContext, CliDependencies } from "../app/types";
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
    .option("--folder <folder-id>", "Folder ID; defaults to the root Folder")
    .requiredOption("--text <text>", "Entry text")
    .action(async (options: { folder?: string; text: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const folderId = await resolveFolderId(dependencies, options.folder);
      if (folderId instanceof Error)
        return handleExpectedError(context, folderId);

      const createdEntry = await dependencies.entryService.createEntry({
        folderId,
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
    .option("--folder <folder-id>", "Folder ID; defaults to the root Folder")
    .action(async (options: { folder?: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const folderId = await resolveFolderId(dependencies, options.folder);
      if (folderId instanceof Error)
        return handleExpectedError(context, folderId);

      const entries =
        await dependencies.entryService.getEntriesInFolder(folderId);
      if (entries instanceof Error)
        return handleExpectedError(context, entries);

      for (const entry of entries) {
        context.output.writeData(`${entry.id}\t${entry.text}`);
      }
    });
};

async function resolveFolderId(
  dependencies: CliDependencies,
  folderId: string | undefined
) {
  if (folderId !== undefined) return folderId;

  const rootFolder = await dependencies.folderService.getRootFolder();
  if (rootFolder instanceof Error) return rootFolder;
  return rootFolder.id;
}
