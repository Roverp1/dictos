import type { Command } from "commander";
import { CliExitCode, type CliContext } from "../app/types";
import { serializeOverlayJsonResponse } from "../app/overlay-json";
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

  model
    .command("current")
    .option("--json", "Output one JSON envelope")
    .action(async (options: { json?: boolean }) => {
      const dependencies = options.json
        ? await context.getProviderDependencies()
        : await getProviderDependenciesOrExit(context);
      if (dependencies instanceof Error) {
        context.output.writeData(
          serializeOverlayJsonResponse(dependencies).slice(0, -1)
        );
        context.output.writeError("Operation failed");
        process.exitCode = CliExitCode.UnexpectedFailure;
        return;
      }
      if (dependencies === null) return;
      const selected = await dependencies.modelSelectionService.current();
      if (selected instanceof Error && options.json) {
        context.output.writeData(
          serializeOverlayJsonResponse(selected, "MODEL_UNAVAILABLE").slice(
            0,
            -1
          )
        );
        context.output.writeError("Selected Model is unavailable");
        process.exitCode = CliExitCode.ExpectedFailure;
        return;
      }
      if (selected instanceof Error)
        return handleExpectedError(context, selected, {
          logger: dependencies.logger,
          operation: "model.current",
        });
      if (options.json) {
        context.output.writeData(
          serializeOverlayJsonResponse(
            selected === null
              ? null
              : { id: `${selected.providerId}/${selected.modelId}` }
          ).slice(0, -1)
        );
      } else {
        context.output.writeData(
          selected === null
            ? "No Model selected."
            : sanitizeTerminalText(`${selected.providerId}/${selected.modelId}`)
        );
      }
      logOperationCompleted({
        logger: dependencies.logger,
        operation: "model.current",
        context: { selected: selected !== null },
      });
    });
};
