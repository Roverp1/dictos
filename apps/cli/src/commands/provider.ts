import type { Command } from "commander";
import { ValidationError } from "@dictos/core";
import { CliExitCode, type CliContext } from "../app/types";
import {
  getProviderDependenciesOrExit,
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

  provider.command("available").action(async () => {
    const dependencies = await getProviderDependenciesOrExit(context);
    if (dependencies === null) return;
    const providers =
      await dependencies.modelCatalogService.supportedProviders();
    if (providers instanceof Error)
      return handleExpectedError(context, providers, {
        logger: dependencies.logger,
        operation: "provider.available",
      });
    for (const item of providers) context.output.writeData(item.id);
    logOperationCompleted({
      logger: dependencies.logger,
      operation: "provider.available",
    });
  });

  for (const action of ["connect", "reconnect"] as const) {
    provider
      .command(action)
      .argument("[provider-id]", "Provider ID (required)")
      .action(async (providerId?: string) => {
        if (providerId === undefined) {
          context.output.writeError(
            `provider ${action} requires <provider-id>`
          );
          process.exitCode = CliExitCode.UsageError;
          return;
        }
        const dependencies = await getProviderDependenciesOrExit(context);
        if (dependencies === null) return;
        const available =
          await dependencies.modelCatalogService.supportedProviders();
        if (available instanceof Error)
          return handleExpectedError(context, available);
        if (!available.some((item) => item.id === providerId))
          return handleExpectedError(
            context,
            new ValidationError({ reason: "Unknown Provider ID." })
          );
        const log = {
          logger: dependencies.logger,
          operation: `provider.${action}`,
          context: { providerId },
        };

        const connections =
          await dependencies.providerConnectionService.getConnections();
        if (connections instanceof Error)
          return handleExpectedError(context, connections, log);
        const exists = connections.some(
          (item) => item.providerId === providerId
        );
        if (action === "connect" && exists)
          return handleExpectedError(
            context,
            new ValidationError({
              reason: "Provider Connection already exists. Use reconnect.",
            }),
            log
          );
        if (action === "reconnect" && !exists)
          return handleExpectedError(
            context,
            new ValidationError({
              reason: "Provider Connection not found. Use connect.",
            }),
            log
          );

        const apiKey = await context.terminalPrompt.readSecret("API key: ");
        if (apiKey instanceof Error)
          return handleExpectedError(context, apiKey, log);
        const result =
          action === "connect"
            ? await dependencies.providerConnectionService.connect({
                providerId,
                apiKey,
              })
            : await dependencies.providerConnectionService.replaceKey({
                providerId,
                apiKey,
              });
        if (result instanceof Error)
          return handleExpectedError(context, result, log);
        context.output.writeData(`${result.providerId}\tconfigured`);
        logOperationCompleted(log);
      });
  }

  provider.command("list").action(async () => {
    const dependencies = await getProviderDependenciesOrExit(context);
    if (dependencies === null) return;
    const connections =
      await dependencies.providerConnectionService.getConnections();
    if (connections instanceof Error)
      return handleExpectedError(context, connections, {
        logger: dependencies.logger,
        operation: "provider.list",
      });
    for (const connection of connections)
      context.output.writeData(`${connection.providerId}\tconfigured`);
    logOperationCompleted({
      logger: dependencies.logger,
      operation: "provider.list",
    });
  });

  provider
    .command("disconnect")
    .argument("[provider-id]", "Provider ID (required)")
    .option("--yes", "Confirm disconnection")
    .action(
      async (providerId: string | undefined, options: { yes?: boolean }) => {
        if (providerId === undefined) {
          context.output.writeError(
            "provider disconnect requires <provider-id>"
          );
          process.exitCode = CliExitCode.UsageError;
          return;
        }
        if (
          !requireConfirmation(context, options.yes, "Disconnecting a Provider")
        )
          return;
        const dependencies = await getProviderDependenciesOrExit(context);
        if (dependencies === null) return;
        const available =
          await dependencies.modelCatalogService.supportedProviders();
        if (available instanceof Error)
          return handleExpectedError(context, available);
        if (!available.some((item) => item.id === providerId))
          return handleExpectedError(
            context,
            new ValidationError({ reason: "Unknown Provider ID." })
          );
        const log = {
          logger: dependencies.logger,
          operation: "provider.disconnect",
          context: { providerId },
        };
        const disconnected =
          await dependencies.providerConnectionService.disconnect(providerId);
        if (disconnected instanceof Error)
          return handleExpectedError(context, disconnected, log);
        context.output.writeData(`${disconnected.providerId}\tdisconnected`);
        logOperationCompleted(log);
      }
    );
};
