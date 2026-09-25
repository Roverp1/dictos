import type { Command } from "commander";

import type { CliContext, CliDependencies } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
  logOperationCompleted,
  requireConfirmation,
  sanitizeTerminalText,
} from "../app/command-action";
import {
  descriptionTypes,
  type DescriptionGenerationProposal,
  type DescriptionType,
  type NewDescription,
  ValidationError,
} from "@dictos/core";

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
    .option("--type <type>", "Description Type")
    .action(async (options: { entry: string; text: string; type?: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const type = parseDescriptionType(options.type);
      if (type instanceof Error)
        return handleExpectedError(context, type, {
          logger: dependencies.logger,
          operation: "description.create",
          context: { phase: "validate", entryId: options.entry },
        });
      const newDescription: NewDescription = {
        entryId: options.entry,
        text: options.text,
        type,
      };

      const createdDescription =
        await dependencies.descriptionService.createDescription(newDescription);

      if (createdDescription instanceof Error)
        return handleExpectedError(context, createdDescription, {
          logger: dependencies.logger,
          operation: "description.create",
          context: { phase: "persist", entryId: options.entry },
        });

      context.output.writeData(createdDescription.id);
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "description.create",
        context: {
          descriptionId: createdDescription.id,
          entryId: createdDescription.entryId,
          descriptionType: createdDescription.type,
        },
      });
    });

  description
    .command("update")
    .description("Update a Description")
    .argument("<description-id>", "Description ID")
    .option("--text <text>", "new Description text")
    .option("--type <type>", "new Description Type")
    .option("--entry-id <entry-id>", "new Entry ID")
    .action(
      async (
        descriptionId: string,
        options: { text?: string; entryId?: string; type?: string }
      ) => {
        const dependencies = await getDependenciesOrExit(context);
        if (dependencies === null) return;

        const type = parseDescriptionType(options.type);
        if (type instanceof Error)
          return handleExpectedError(context, type, {
            logger: dependencies.logger,
            operation: "description.update",
            context: { phase: "validate", descriptionId },
          });
        const updatedDescription =
          await dependencies.descriptionService.updateDescription({
            id: descriptionId,
            ...options,
            type,
          });

        if (updatedDescription instanceof Error)
          return handleExpectedError(context, updatedDescription, {
            logger: dependencies.logger,
            operation: "description.update",
            context: { phase: "persist", descriptionId },
          });
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "description.update",
          context: {
            descriptionId,
            entryId: updatedDescription.entryId,
            descriptionType: updatedDescription.type,
          },
        });
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
        return handleExpectedError(context, deletedDescription, {
          logger: dependencies.logger,
          operation: "description.delete",
          context: { descriptionId },
        });
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "description.delete",
        context: { descriptionId },
      });
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
        return handleExpectedError(context, descriptions, {
          logger: dependencies.logger,
          operation: "description.list",
          context: { entryId: options.entry },
        });

      for (const desc of descriptions) {
        context.output.writeData(
          `${desc.id}\t${desc.type}\t${desc.senseId ?? "-"}\t${desc.text}`
        );
      }
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "description.list",
        context: {
          entryId: options.entry,
          descriptionCount: descriptions.length,
        },
      });
    });

  description
    .command("assign-sense")
    .description("Assign a Description to a Sense")
    .argument("<description-id>", "Description ID")
    .requiredOption("--sense <sense-id>", "Sense ID")
    .action(async (descriptionId: string, options: { sense: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const assigned = await dependencies.descriptionService.assignToSense({
        descriptionId,
        senseId: options.sense,
      });
      if (assigned instanceof Error)
        return handleExpectedError(context, assigned, {
          logger: dependencies.logger,
          operation: "description.assign_sense",
          context: { descriptionId, senseId: options.sense },
        });
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "description.assign_sense",
        context: { descriptionId, senseId: options.sense },
      });
    });

  description
    .command("detach-sense")
    .description("Detach a Description from its Sense")
    .argument("<description-id>", "Description ID")
    .action(async (descriptionId: string) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const detached =
        await dependencies.descriptionService.detachFromSense(descriptionId);
      if (detached instanceof Error)
        return handleExpectedError(context, detached, {
          logger: dependencies.logger,
          operation: "description.detach_sense",
          context: { descriptionId },
        });
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "description.detach_sense",
        context: { descriptionId },
      });
    });

  description
    .command("generate")
    .description("Generate Descriptions")
    .argument("<description-id>", "Source Description ID")
    .requiredOption("--instruction <instruction-id>", "Instruction ID")
    .requiredOption("--provider <connection-id>", "Provider Connection ID")
    .requiredOption("--model <model-id>", "Model ID")
    .requiredOption("--types <type,...>", "Description Types")
    .option("--allow-duplicate", "Create a suspected duplicate Sense")
    .action(
      async (
        descriptionId: string,
        options: {
          instruction: string;
          provider: string;
          model: string;
          types: string;
          allowDuplicate?: boolean;
        }
      ) => {
        const dependencies = await getDependenciesOrExit(context);
        if (dependencies === null) return;
        const types = parseDescriptionTypes(options.types);
        if (types instanceof Error)
          return handleExpectedError(context, types, {
            logger: dependencies.logger,
            operation: "description.generate",
            context: {
              phase: "validate",
              sourceDescriptionId: descriptionId,
              providerConnectionId: options.provider,
              modelId: options.model,
            },
          });
        const proposal =
          await dependencies.descriptionGenerationService.createProposal({
            sourceDescriptionId: descriptionId,
            instructionId: options.instruction,
            providerConnectionId: options.provider,
            modelId: options.model,
            targetTypes: types,
          });
        if (proposal instanceof Error)
          return handleExpectedError(context, proposal, {
            logger: dependencies.logger,
            operation: "description.generate",
            context: {
              phase: "proposal",
              sourceDescriptionId: descriptionId,
              instructionId: options.instruction,
              providerConnectionId: options.provider,
              modelId: options.model,
              targetTypes: types,
            },
          });
        const accepted = await acceptProposal(
          context,
          dependencies,
          proposal,
          options.allowDuplicate === true
        );
        if (accepted instanceof Error)
          return handleExpectedError(context, accepted, {
            logger: dependencies.logger,
            operation: "description.generate",
            context: {
              phase: "duplicate_confirmation",
              sourceDescriptionId: descriptionId,
              providerConnectionId: options.provider,
              modelId: options.model,
            },
          });
        if (!accepted) {
          context.output.writeData("Generation discarded");
          logOperationCompleted({
            logger: dependencies.logger,
            operation: "description.generate",
            context: {
              outcome: "discarded",
              sourceDescriptionId: descriptionId,
              providerConnectionId: options.provider,
              modelId: options.model,
            },
          });
          return;
        }
        const committed =
          await dependencies.descriptionGenerationService.commitProposal(
            proposal
          );
        if (committed instanceof Error)
          return handleExpectedError(context, committed, {
            logger: dependencies.logger,
            operation: "description.generate",
            context: {
              phase: "commit",
              sourceDescriptionId: descriptionId,
              providerConnectionId: options.provider,
              modelId: options.model,
            },
          });
        context.output.writeData(committed.sense.id);
        for (const generated of committed.generatedDescriptions)
          context.output.writeData(generated.id);
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "description.generate",
          context: {
            outcome: "committed",
            sourceDescriptionId: descriptionId,
            providerConnectionId: options.provider,
            modelId: options.model,
            senseId: committed.sense.id,
            descriptionCount: committed.generatedDescriptions.length,
          },
        });
      }
    );
};

function parseDescriptionType(
  value: string | undefined
): DescriptionType | undefined | ValidationError {
  if (value === undefined) return undefined;
  if (descriptionTypes.includes(value as DescriptionType))
    return value as DescriptionType;
  return new ValidationError({ reason: `Unknown Description Type: ${value}` });
}

function parseDescriptionTypes(
  value: string
): DescriptionType[] | ValidationError {
  const types = value.split(",").map((type) => type.trim());
  if (
    types.length === 0 ||
    types.some((type) => !descriptionTypes.includes(type as DescriptionType))
  )
    return new ValidationError({
      reason: "--types must contain valid Description Types.",
    });
  if (new Set(types).size !== types.length)
    return new ValidationError({ reason: "Description Types must be unique." });
  return types as DescriptionType[];
}

async function acceptProposal(
  context: CliContext,
  dependencies: CliDependencies,
  proposal: DescriptionGenerationProposal,
  allowDuplicate: boolean
) {
  if (
    proposal.target.kind !== "new" ||
    proposal.target.duplicateCandidateSenseId === null
  )
    return true;
  const candidate = await dependencies.senseService.getSenseById(
    proposal.target.duplicateCandidateSenseId
  );
  if (candidate instanceof Error) return candidate;
  if (candidate !== null)
    context.output.writeData(
      `Suspected duplicate Sense: ${sanitizeTerminalText(candidate.id)}\t${sanitizeTerminalText(candidate.name)}`
    );
  context.output.writeData(
    `Proposed Sense: ${sanitizeTerminalText(proposal.target.senseName)}`
  );
  for (const description of proposal.descriptions)
    context.output.writeData(
      `${description.type}\t${sanitizeTerminalText(description.text)}`
    );
  if (allowDuplicate) return true;
  return await context.terminalPrompt.confirm("Create duplicate Sense?");
}
