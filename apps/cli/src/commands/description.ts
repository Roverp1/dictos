import type { Command } from "commander";

import type { CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
  requireConfirmation,
} from "../app/command-action";
import type { NewDescription } from "@dictos/core";

export const registerDescriptionCommands = (
  program: Command,
  context: CliContext
) => {
  const description = program
    .command("description")
    .description("Manage Descriptions");

  description
    .command("create")
    .description("Create a Description")
    .requiredOption("--entry <entry-id>", "Entry ID")
    .requiredOption("--text <text>", "Description text")
    .action(async (options: { entry: string; text: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const newDescription: NewDescription = {
        entryId: options.entry,
        text: options.text,
      };

      const createdDescription =
        await dependencies.descriptionService.createDescription(newDescription);

      if (createdDescription instanceof Error)
        return handleExpectedError(context, createdDescription);

      context.output.writeData(createdDescription.id);
    });

  description
    .command("update")
    .description("Update a Description")
    .argument("<description-id>", "Description ID")
    .option("--text <text>", "new Description text")
    .option("--entry-id <entry-id>", "new Entry ID")
    .action(
      async (
        descriptionId: string,
        options: { text?: string; entryId?: string }
      ) => {
        const dependencies = await getDependenciesOrExit(context);
        if (dependencies === null) return;

        const updatedDescription =
          await dependencies.descriptionService.updateDescription(
            descriptionId,
            options
          );

        if (updatedDescription instanceof Error)
          return handleExpectedError(context, updatedDescription);
      }
    );

  description
    .command("delete")
    .description("Delete a Description")
    .argument("<description-id>", "Description ID")
    .option("--yes", "confirm deletion")
    .action(async (descriptionId: string, options: { yes?: boolean }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const confirmed = requireConfirmation(
        context,
        options.yes,
        "Deleting a Description"
      );
      if (!confirmed) return;

      const deletedDescription =
        await dependencies.descriptionService.deleteDescription(descriptionId);
      if (deletedDescription instanceof Error)
        return handleExpectedError(context, deletedDescription);
    });

  description
    .command("list")
    .description("List Descriptions")
    .requiredOption("--entry <entry-id>", "Entry ID")
    .action(async (options: { entry: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const descriptions =
        await dependencies.descriptionService.getDescriptionsForEntry(
          options.entry
        );
      if (descriptions instanceof Error)
        return handleExpectedError(context, descriptions);

      for (const desc of descriptions) {
        context.output.writeData(`${desc.id}\t${desc.text}`);
      }
    });
};
