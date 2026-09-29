import type { Command } from "commander";
import type { CliContext } from "../app/types";
import {
  getProviderDependenciesOrExit,
  handleExpectedError,
  logOperationCompleted,
  sanitizeTerminalText,
} from "../app/command-action";

export const registerModelCommands = (
  program: Command,
  context: CliContext
) => {
  const model = program
    .command("model")
    .description("Manage the Selected Model");

  model
    .command("select")
    .argument("<provider/model>", "Qualified Model ID")
    .action(async (qualifiedId: string) => {
      const dependencies = await getProviderDependenciesOrExit(context);
      if (dependencies === null) return;
      const selected =
        await dependencies.modelSelectionService.select(qualifiedId);
      if (selected instanceof Error)
        return handleExpectedError(context, selected, {
          logger: dependencies.logger,
          operation: "model.select",
        });
      context.output.writeData(
        sanitizeTerminalText(`${selected.providerId}/${selected.modelId}`)
      );
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "model.select",
        context: { providerId: selected.providerId },
      });
    });

  model.command("current").action(async () => {
    const dependencies = await getProviderDependenciesOrExit(context);
    if (dependencies === null) return;
    const selected = await dependencies.modelSelectionService.current();
    if (selected instanceof Error)
      return handleExpectedError(context, selected, {
        logger: dependencies.logger,
        operation: "model.current",
      });
    context.output.writeData(
      selected === null
        ? "No Model selected."
        : sanitizeTerminalText(`${selected.providerId}/${selected.modelId}`)
    );
    logOperationCompleted({
      logger: dependencies.logger,
      operation: "model.current",
      context: { selected: selected !== null },
    });
  });
};
