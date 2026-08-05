import type { Command } from "commander";

import type { NewFolder } from "@dictos/core";

import { CliExitCode, type CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
  requireConfirmation,
} from "../app/command-action";

export const registerFolderCommands = (
  program: Command,
  context: CliContext
) => {
  const folder = program.command("folder").description("Manage Folders");

  folder
    .command("create")
    .description("Create a Folder")
    .requiredOption("--name <name>", "Folder name")
    .option("--parent <folder-id>", "parent Folder ID")
    .action(async (options: { name: string; parent?: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const parent =
        options.parent === undefined
          ? await dependencies.folderService.getRootFolder()
          : await dependencies.folderService.getFolderById(options.parent);

      if (parent instanceof Error) return handleExpectedError(context, parent);
      if (parent === null) {
        context.output.writeError(`Folder not found: ${options.parent}`);
        process.exitCode = CliExitCode.ExpectedFailure;
        return;
      }

      const newFolder: NewFolder = {
        name: options.name,
        parentId: parent.id,
      };

      const createdFolder =
        await dependencies.folderService.createFolder(newFolder);

      if (createdFolder instanceof Error)
        return handleExpectedError(context, createdFolder);

      context.output.writeData(createdFolder.id);
    });

  folder
    .command("update")
    .description("Update a Folder")
    .argument("<folder-id>", "Folder ID")
    .requiredOption("--name <name>", "new Folder name")
    .action(async (folderId: string, options: { name: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const updatedFolder = await dependencies.folderService.renameFolder(
        folderId,
        options.name
      );

      if (updatedFolder instanceof Error)
        return handleExpectedError(context, updatedFolder);
    });

  folder
    .command("delete")
    .description("Delete a Folder")
    .argument("<folder-id>", "Folder ID")
    .option("--yes", "confirm deletion")
    .action(async (folderId: string, options: { yes?: boolean }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const confirmed = requireConfirmation(
        context,
        options.yes,
        "Deleting a Folder"
      );
      if (!confirmed) return;

      const deletedFolder =
        await dependencies.folderService.deleteFolder(folderId);
      if (deletedFolder instanceof Error)
        return handleExpectedError(context, deletedFolder);
    });

  folder
    .command("list")
    .description("List Folders")
    .option("--parent <folder-id>", "parent Folder ID")
    .action(async (options: { parent?: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const parent =
        options.parent === undefined
          ? await dependencies.folderService.getRootFolder()
          : await dependencies.folderService.getFolderById(options.parent);

      if (parent instanceof Error) return handleExpectedError(context, parent);

      if (parent === null) {
        context.output.writeError(`Folder not found: ${options.parent}`);
        process.exitCode = CliExitCode.ExpectedFailure;
        return;
      }

      const folders = await dependencies.folderService.getSubFolders(parent.id);
      if (folders instanceof Error)
        return handleExpectedError(context, folders);

      for (const folder of folders) {
        context.output.writeData(`${folder.id}\t${folder.name}`);
      }
    });
};
