import { descriptionTypes, type DescriptionType } from "@dictos/core";
import {
  FsOverlayCaptureStateRepository,
  getDictosDataDir,
  type OverlayCaptureLocalState,
} from "@dictos/fs-storage";
import type { Command } from "commander";
import { ConfigurationError } from "@dictos/config";

import {
  readOverlayJsonRequest,
  serializeOverlayJsonResponse,
} from "../app/overlay-json";
import { CliExitCode, type CliContext } from "../app/types";

function isDescriptionType(value: unknown): value is DescriptionType {
  return descriptionTypes.some((type) => type === value);
}

function validateState(value: unknown): OverlayCaptureLocalState | Error {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return new Error("Invalid overlay state");
  if (
    !("version" in value) ||
    value.version !== 1 ||
    !("instructionText" in value) ||
    typeof value.instructionText !== "string" ||
    !("selectedTypes" in value) ||
    !Array.isArray(value.selectedTypes) ||
    !value.selectedTypes.every(isDescriptionType)
  )
    return new Error("Invalid overlay state");
  return {
    version: 1,
    instructionText: value.instructionText,
    selectedTypes: value.selectedTypes,
  };
}

// Main passes its overlay command here; state operations need no Dictionary graph.
export function registerOverlayStateCommands(
  overlay: Command,
  context: CliContext,
  options: { input?: string | ReadableStream<Uint8Array> } = {}
): void {
  const state = overlay
    .command("state")
    .description("Manage overlay-local Instruction and Types");

  function respond(result: OverlayCaptureLocalState | Error): void {
    context.output.writeData(serializeOverlayJsonResponse(result).slice(0, -1));
    if (result instanceof Error)
      process.exitCode =
        result instanceof ConfigurationError
          ? CliExitCode.ConfigurationFailure
          : CliExitCode.ExpectedFailure;
  }

  state
    .command("read")
    .requiredOption("--json", "Output JSON")
    .action(async () => {
      const configuration = await context.getConfiguration();
      if (configuration instanceof Error) return respond(configuration);
      const dataDir = await getDictosDataDir();
      if (dataDir instanceof Error) return respond(dataDir);
      respond(await new FsOverlayCaptureStateRepository(dataDir).read());
    });

  state
    .command("write")
    .requiredOption("--json", "Read and output JSON")
    .action(async () => {
      const request = await readOverlayJsonRequest({
        input: options.input ?? Bun.stdin.stream(),
        validate: validateState,
      });
      if (request instanceof Error) return respond(request);
      const configuration = await context.getConfiguration();
      if (configuration instanceof Error) return respond(configuration);
      const dataDir = await getDictosDataDir();
      if (dataDir instanceof Error) return respond(dataDir);
      respond(
        await new FsOverlayCaptureStateRepository(dataDir).replace(request)
      );
    });
}
