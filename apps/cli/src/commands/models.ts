import type { Command } from "commander";
import type { CliContext } from "../app/types";
import {
  getProviderDependenciesOrExit,
  handleExpectedError,
  logOperationCompleted,
  sanitizeTerminalText,
} from "../app/command-action";
import { ValidationError } from "@dictos/core";

export const registerModelsCommands = (
  program: Command,
  context: CliContext
) => {
  program
    .command("models")
    .argument("[provider-id]", "Filter by Provider ID")
    .option("--refresh", "Refresh the Model Catalog")
    .option("--verbose", "Show Model metadata")
    .action(
      async (
        providerId: string | undefined,
        options: { refresh?: boolean; verbose?: boolean }
      ) => {
        const dependencies = await getProviderDependenciesOrExit(context);
        if (dependencies === null) return;
        const failure = (error: Error) =>
          handleExpectedError(context, error, {
            logger: dependencies.logger,
            operation: "models.list",
            context: {
              providerId: providerId ?? null,
              refresh: options.refresh === true,
            },
          });

        if (providerId !== undefined) {
          const providers =
            await dependencies.modelCatalogService.supportedProviders();
          if (providers instanceof Error) return failure(providers);
          if (!providers.some((provider) => provider.id === providerId))
            return failure(
              new ValidationError({ reason: "Unknown Provider ID." })
            );
        }

        if (options.refresh) {
          const refreshed = await dependencies.modelCatalogService.refresh();
          if (refreshed instanceof Error) return failure(refreshed);
        }

        const models = await dependencies.modelCatalogService.configuredModels(
          providerId === undefined ? undefined : { providerId }
        );
        if (models instanceof Error) return failure(models);
        const catalog = await dependencies.modelCatalog.get();
        if (catalog instanceof Error) return failure(catalog);

        for (const model of models) {
          const id = sanitizeTerminalText(
            `${model.providerId}/${model.modelId}`
          );
          if (!options.verbose) {
            context.output.writeData(id);
            continue;
          }
          const cost = model.cost;
          const input =
            cost && Number.isFinite(cost.input) && cost.input >= 0
              ? String(cost.input)
              : "-";
          const output =
            cost && Number.isFinite(cost.output) && cost.output >= 0
              ? String(cost.output)
              : "-";
          context.output.writeData(
            [
              id,
              sanitizeTerminalText(model.name),
              sanitizeTerminalText(model.status),
              input,
              output,
            ].join("\t")
          );
        }
        process.stderr.write(
          `Model Catalog: ${sanitizeTerminalText(catalog.source)} (${sanitizeTerminalText(catalog.fetchedAt)})\n`
        );
        logOperationCompleted({
          logger: dependencies.logger,
          operation: "models.list",
          context: {
            providerId: providerId ?? null,
            modelCount: models.length,
            source: catalog.source,
          },
        });
      }
    );
};
