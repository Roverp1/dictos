import type { Command } from "commander";
import { ConfigurationError } from "@dictos/config";
import { configurationFailureResponse } from "../app/configuration-error";
import { loadNativeConfiguration } from "../app/configuration";
import type { Logger } from "@dictos/logger";
import {
  descriptionTypes,
  parseQualifiedModelId,
  type DescriptionType,
  type ScreenDescriptionInput,
  type ScreenEntrySaveInput,
} from "@dictos/core";

import { DatabaseInUseError } from "../app/errors";
import {
  readOverlayJsonRequest,
  serializeOverlayJsonResponse,
  type OverlayJsonErrorCode,
} from "../app/overlay-json";
import { CliExitCode, type CliContext } from "../app/types";
import {
  logOperationCompleted,
  logOperationFailed,
} from "../app/command-action";
import { registerOverlayStateCommands } from "./overlay-state";

type SuggestRequest = {
  model: string;
  entryText: string;
  descriptionText: string | null;
  instructionText: string;
};
type GenerateRequest = SuggestRequest & {
  senseName: string | null;
  descriptions: ScreenDescriptionInput[];
  targetTypes: DescriptionType[];
};
type SaveRequest =
  | Omit<Extract<ScreenEntrySaveInput, { kind: "entry" }>, "folderId">
  | Omit<Extract<ScreenEntrySaveInput, { kind: "sense" }>, "folderId">;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function descriptionType(value: unknown): value is DescriptionType {
  return descriptionTypes.some((type) => type === value);
}

function text(value: unknown): value is string {
  return typeof value === "string";
}

function optionalText(value: unknown): value is string | null {
  return value === null || text(value);
}

function descriptions(value: unknown): value is ScreenDescriptionInput[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => record(item) && descriptionType(item.type) && text(item.text)
    )
  );
}

function invalidRequest(): Error {
  return new Error("Invalid overlay request");
}

function suggestRequest(value: unknown): SuggestRequest | Error {
  if (
    !record(value) ||
    !text(value.entryText) ||
    !optionalText(value.descriptionText) ||
    !text(value.instructionText) ||
    !text(value.model) ||
    parseQualifiedModelId(value.model) instanceof Error
  )
    return invalidRequest();
  return {
    model: value.model,
    entryText: value.entryText,
    descriptionText: value.descriptionText,
    instructionText: value.instructionText,
  };
}

function generateRequest(value: unknown): GenerateRequest | Error {
  const shared = suggestRequest(value);
  if (shared instanceof Error) return shared;
  if (
    !record(value) ||
    !optionalText(value.senseName) ||
    !descriptions(value.descriptions) ||
    !Array.isArray(value.targetTypes) ||
    !value.targetTypes.every(descriptionType)
  )
    return invalidRequest();
  return {
    ...shared,
    senseName: value.senseName,
    descriptions: value.descriptions,
    targetTypes: value.targetTypes,
  };
}

function saveRequest(value: unknown): SaveRequest | Error {
  if (
    !record(value) ||
    !text(value.entryText) ||
    !optionalText(value.descriptionText)
  )
    return invalidRequest();
  if (value.kind === "entry")
    return {
      kind: "entry",
      entryText: value.entryText,
      descriptionText: value.descriptionText,
    };
  if (
    value.kind !== "sense" ||
    !text(value.senseName) ||
    typeof value.includeDescription !== "boolean" ||
    !descriptions(value.descriptions)
  )
    return invalidRequest();
  return {
    kind: "sense",
    entryText: value.entryText,
    descriptionText: value.descriptionText,
    includeDescription: value.includeDescription,
    senseName: value.senseName,
    descriptions: value.descriptions,
  };
}

export function registerOverlayCommands(
  program: Command,
  context: CliContext,
  options: { input?: string | ReadableStream<Uint8Array> } = {}
): void {
  const overlay = program
    .command("overlay")
    .description("Review screen text in Dictos");
  registerOverlayStateCommands(overlay, context, options);

  overlay
    .command("bootstrap")
    .requiredOption("--json", "Output the opening's configuration snapshot")
    .action(async () =>
      respond({ result: await loadNativeConfiguration("overlay"), json: true })
    );

  function respond<T>({
    result,
    json,
    human = () => {},
    failedInput = false,
    log,
  }: {
    result: T | Error;
    json: boolean;
    human?: (data: T) => void;
    failedInput?: boolean;
    log?: { logger: Logger; operation: string };
  }): void {
    if (json) {
      const errorCode: OverlayJsonErrorCode =
        result instanceof DatabaseInUseError
          ? "DATABASE_IN_USE"
          : "OPERATION_FAILED";
      context.output.writeData(
        serializeOverlayJsonResponse(result, errorCode).slice(0, -1)
      );
    }
    if (result instanceof Error) {
      if (log)
        logOperationFailed({ ...log, error: result, redactDetails: true });
      if (!json)
        context.output.writeError(
          result instanceof ConfigurationError
            ? configurationFailureResponse({ error: result }).error.message
            : result.message
        );
      process.exitCode =
        result instanceof ConfigurationError
          ? CliExitCode.ConfigurationFailure
          : failedInput
            ? CliExitCode.UsageError
            : result instanceof DatabaseInUseError
              ? CliExitCode.DatabaseInUse
              : CliExitCode.ExpectedFailure;
      return;
    }
    if (!json) human(result);
    if (log) logOperationCompleted(log);
  }

  overlay
    .command("suggest")
    .option("--json", "Output one JSON envelope")
    .action(async ({ json }: { json?: boolean }) => {
      const request = await readOverlayJsonRequest({
        input: options.input ?? Bun.stdin.stream(),
        validate: suggestRequest,
      });
      if (request instanceof Error)
        return respond({
          result: request,
          json: json === true,
          failedInput: true,
        });
      const deps = await context.getProviderDependencies();
      if (deps instanceof Error)
        return respond({ result: deps, json: json === true });
      const log = { logger: deps.logger, operation: "overlay.suggest" };
      const model = parseQualifiedModelId(request.model);
      if (model instanceof Error)
        return respond({ result: model, json: json === true, log });
      const senses = await deps.screenEntryGenerationService.suggestSenses({
        ...request,
        model,
      });
      if (senses instanceof Error)
        return respond({ result: senses, json: json === true, log });
      respond({
        result: { senses },
        json: json === true,
        log,
        human: ({ senses }) => {
          for (const sense of senses)
            context.output.writeData(`${sense.name}\t${sense.definition}`);
        },
      });
    });

  overlay
    .command("generate")
    .option("--json", "Output one JSON envelope")
    .action(async ({ json }: { json?: boolean }) => {
      const request = await readOverlayJsonRequest({
        input: options.input ?? Bun.stdin.stream(),
        validate: generateRequest,
      });
      if (request instanceof Error)
        return respond({
          result: request,
          json: json === true,
          failedInput: true,
        });
      const deps = await context.getProviderDependencies();
      if (deps instanceof Error)
        return respond({ result: deps, json: json === true });
      const log = { logger: deps.logger, operation: "overlay.generate" };
      const model = parseQualifiedModelId(request.model);
      if (model instanceof Error)
        return respond({ result: model, json: json === true, log });
      const result =
        await deps.screenEntryGenerationService.generateDescriptions({
          entryText: request.entryText,
          descriptionText: request.descriptionText,
          senseName: request.senseName,
          existingDescriptions: request.descriptions,
          instructionText: request.instructionText,
          targetTypes: request.targetTypes,
          model,
        });
      if (result instanceof Error)
        return respond({ result, json: json === true, log });
      respond({
        result,
        json: json === true,
        log,
        human: (draft) => {
          context.output.writeData(draft.senseName);
          for (const description of draft.descriptions)
            context.output.writeData(
              `${description.type}\t${description.text}`
            );
        },
      });
    });

  overlay
    .command("save")
    .option("--json", "Output one JSON envelope")
    .action(async ({ json }: { json?: boolean }) => {
      const request = await readOverlayJsonRequest({
        input: options.input ?? Bun.stdin.stream(),
        validate: saveRequest,
      });
      if (request instanceof Error)
        return respond({
          result: request,
          json: json === true,
          failedInput: true,
        });
      const deps = await context.getDependencies();
      if (deps instanceof Error)
        return respond({ result: deps, json: json === true });
      const log = { logger: deps.logger, operation: "overlay.save" };
      const root = await deps.folderService.getRootFolder();
      if (root instanceof Error)
        return respond({ result: root, json: json === true, log });
      const saved = await deps.screenEntrySaveService.save({
        ...request,
        folderId: root.id,
      });
      if (saved instanceof Error)
        return respond({ result: saved, json: json === true, log });
      const result = {
        entryId: saved.entry.id,
        senseId: saved.sense?.id ?? null,
        capturedDescriptionId: saved.capturedDescription?.id ?? null,
        descriptionIds: saved.descriptions.map(({ id }) => id),
      };
      respond({
        result,
        json: json === true,
        log,
        human: ({
          entryId,
          senseId,
          capturedDescriptionId,
          descriptionIds,
        }) => {
          context.output.writeData(entryId);
          if (senseId !== null) context.output.writeData(senseId);
          if (capturedDescriptionId !== null)
            context.output.writeData(capturedDescriptionId);
          for (const id of descriptionIds) context.output.writeData(id);
        },
      });
    });
}
