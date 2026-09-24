import type { Command } from "commander";
import { ValidationError } from "@dictos/core";
import type { CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
  logOperationCompleted,
  requireConfirmation,
} from "../app/command-action";

export const registerProviderCommands = (
  program: Command,
  context: CliContext
) => {
  const provider = program
    .command("provider")
    .description("Manage Provider Connections");
  provider.command("presets").action(async () => {
    const dependencies = await getDependenciesOrExit(context);
    if (dependencies === null) return;
    const presets = dependencies.providerConnectionService.getPresets();
    for (const preset of presets)
      context.output.writeData(
        `${preset.id}\t${preset.name}\t${preset.baseUrl}`
      );
    logOperationCompleted({
      logger: dependencies.logger,
      operation: "provider.presets",
      context: { presetCount: presets.length },
    });
  });
  provider
    .command("connect")
    .requiredOption("--name <name>", "Connection name")
    .option("--preset <preset-id>", "Provider preset")
    .option("--base-url <url>", "Custom Provider endpoint")
    .action(
      async (options: { name: string; preset?: string; baseUrl?: string }) => {
        if (options.preset !== undefined && options.baseUrl !== undefined)
          return handleExpectedError(
            context,
            new ValidationError({
              reason:
                "Choose a Provider preset or a custom endpoint, not both.",
            })
          );
        if (options.preset === undefined && options.baseUrl === undefined)
          return handleExpectedError(
            context,
            new ValidationError({
              reason: "Choose a Provider preset or a custom endpoint.",
            })
          );
        const dependencies = await getDependenciesOrExit(context);
        if (dependencies === null) return;
        const apiKey = await context.terminalPrompt.readSecret("API key: ");
        if (apiKey instanceof Error)
          return handleExpectedError(context, apiKey, {
            logger: dependencies.logger,
            operation: "provider.connect",
            context: { phase: "read_credential" },
          });
        const connection =
          await dependencies.providerConnectionService.createConnection({
            name: options.name,
            presetId: options.preset,
            baseUrl: options.baseUrl,
            apiKey,
          });
        if (connection instanceof Error)
          return handleExpectedError(context, connection, {
            logger: dependencies.logger,
            operation: "provider.connect",
            context: { phase: "persist", presetId: options.preset ?? null },
          });
        context.output.writeData(
          `Provider Connection created: ${connection.id}`
        );
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "provider.connect",
          context: {
            providerConnectionId: connection.id,
            presetId: connection.presetId,
          },
        });
      }
    );
  provider.command("list").action(async () => {
    const dependencies = await getDependenciesOrExit(context);
    if (dependencies === null) return;
    const connections =
      await dependencies.providerConnectionService.getConnections();
    if (connections instanceof Error)
      return handleExpectedError(context, connections, {
        logger: dependencies.logger,
        operation: "provider.list",
      });
    for (const connection of connections)
      context.output.writeData(
        `${connection.id}\t${connection.name}\t${connection.presetId ?? ""}\t${connection.baseUrl}`
      );
    logOperationCompleted({
      logger: dependencies.logger,
      operation: "provider.list",
      context: { providerConnectionCount: connections.length },
    });
  });
  provider
    .command("models")
    .argument("<connection-id>", "Provider Connection ID")
    .action(async (id: string) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;
      const models =
        await dependencies.providerConnectionService.discoverModels(id);
      if (models instanceof Error)
        return handleExpectedError(context, models, {
          logger: dependencies.logger,
          operation: "provider.models",
          context: { providerConnectionId: id },
        });
      for (const model of models)
        context.output.writeData(sanitizeTerminalText(model));
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "provider.models",
        context: { providerConnectionId: id, modelCount: models.length },
      });
    });
  provider
    .command("update")
    .argument("<connection-id>", "Provider Connection ID")
    .option("--name <name>", "Connection name")
    .option("--preset <preset-id>", "Provider preset")
    .option("--base-url <url>", "Custom Provider endpoint")
    .option("--replace-key", "Replace API key")
    .action(
      async (
        id: string,
        options: {
          name?: string;
          preset?: string;
          baseUrl?: string;
          replaceKey?: boolean;
        }
      ) => {
        if (options.preset !== undefined && options.baseUrl !== undefined)
          return handleExpectedError(
            context,
            new ValidationError({
              reason:
                "Choose a Provider preset or a custom endpoint, not both.",
            })
          );
        const dependencies = await getDependenciesOrExit(context);
        if (dependencies === null) return;
        const apiKey = options.replaceKey
          ? await context.terminalPrompt.readSecret("New API key: ")
          : undefined;
        if (apiKey instanceof Error)
          return handleExpectedError(context, apiKey, {
            logger: dependencies.logger,
            operation: "provider.update",
            context: {
              phase: "read_credential",
              providerConnectionId: id,
            },
          });
        const updated =
          await dependencies.providerConnectionService.updateConnection({
            id,
            ...(options.name === undefined ? {} : { name: options.name }),
            ...(options.preset === undefined
              ? options.baseUrl === undefined
                ? {}
                : { presetId: null }
              : { presetId: options.preset }),
            ...(options.baseUrl === undefined
              ? {}
              : { baseUrl: options.baseUrl }),
            ...(apiKey === undefined ? {} : { apiKey }),
          });
        if (updated instanceof Error)
          return handleExpectedError(context, updated, {
            logger: dependencies.logger,
            operation: "provider.update",
            context: { phase: "persist", providerConnectionId: id },
          });
        context.output.writeData(`Provider Connection updated: ${updated.id}`);
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "provider.update",
          context: {
            providerConnectionId: updated.id,
            presetId: updated.presetId,
            credentialReplaced: apiKey !== undefined,
          },
        });
      }
    );
  provider
    .command("delete")
    .argument("<connection-id>", "Provider Connection ID")
    .option("--yes", "Confirm deletion")
    .action(async (id: string, options: { yes?: boolean }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (
        dependencies === null ||
        !requireConfirmation(
          context,
          options.yes,
          "Deleting a Provider Connection"
        )
      )
        return;
      const deleted =
        await dependencies.providerConnectionService.deleteConnection(id);
      if (deleted instanceof Error)
        return handleExpectedError(context, deleted, {
          logger: dependencies.logger,
          operation: "provider.delete",
          context: { providerConnectionId: id },
        });
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "provider.delete",
        context: { providerConnectionId: id },
      });
    });
};

function sanitizeTerminalText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
}
