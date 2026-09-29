import { afterEach, describe, expect, test } from "bun:test";
import type {
  DescriptionGenerationProposal,
  DescriptionGenerationResult,
  DescriptionGenerationService,
  ModelSelectionService,
  SelectedModel,
  Sense,
} from "@dictos/core";
import {
  DbError,
  DescriptionGenerationError,
  NotFoundError,
  ValidationError,
} from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { createCliProgram } from "../app/program";
import { PromptError } from "../app/errors";
import type { CliContext, CliDependencies } from "../app/types";

const proposal: DescriptionGenerationProposal = {
  entryId: "entry-1",
  sourceDescriptionId: "source-1",
  expectedSourceSenseId: null,
  target: {
    kind: "new",
    senseName: "new sense",
    duplicateCandidateSenseId: "sense-1",
  },
  descriptions: [{ type: "definition", text: "generated definition" }],
};

const result: DescriptionGenerationResult = {
  sense: {
    id: "sense-2",
    entryId: "entry-1",
    name: "new sense",
    createdAt: new Date(0),
    modifiedAt: new Date(0),
  },
  sourceDescription: {
    id: "source-1",
    entryId: "entry-1",
    senseId: null,
    type: "definition",
    text: "source",
    createdAt: new Date(0),
    modifiedAt: new Date(0),
  },
  generatedDescriptions: [
    {
      id: "description-2",
      entryId: "entry-1",
      senseId: "sense-2",
      type: "definition",
      text: "generated definition",
      createdAt: new Date(0),
      modifiedAt: new Date(0),
    },
  ],
};

type ProposalInput = Parameters<
  DescriptionGenerationService["createProposal"]
>[0];
type SelectionResult = Awaited<ReturnType<ModelSelectionService["resolve"]>>;
const selectedModel: SelectedModel = {
  providerId: "openai",
  modelId: "model-1",
};

type ErrorEvent = {
  message: string;
  error: unknown;
  context: Context | undefined;
};

function createContext({
  confirmation,
  duplicateCandidate,
  proposalError,
  selectionError,
  promptError,
}: {
  confirmation: boolean;
  duplicateCandidate: Sense | null;
  proposalError?: Error;
  selectionError?: Exclude<SelectionResult, SelectedModel>;
  promptError?: PromptError;
}) {
  const output: string[] = [];
  const errorEvents: ErrorEvent[] = [];
  let proposalInput: ProposalInput | null = null;
  let committedProposal: DescriptionGenerationProposal | null = null;
  let confirmationRequested = false;
  let resolvedOverride: string | undefined;
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (message, error, context) =>
      errorEvents.push({ message, error, context }),
    fatal: () => {},
    child: () => logger,
  };

  const dependencies = {
    logger,
    modelSelectionService: {
      async resolve(input: { override?: string }): Promise<SelectionResult> {
        resolvedOverride = input.override;
        if (selectionError) return selectionError;
        return input.override === "google/gemini-2.5-flash"
          ? { providerId: "google", modelId: "gemini-2.5-flash" }
          : selectedModel;
      },
    },
    descriptionGenerationService: {
      async createProposal(input: ProposalInput) {
        proposalInput = input;
        return proposalError ?? proposal;
      },
      async commitProposal(input: DescriptionGenerationProposal) {
        committedProposal = input;
        return result;
      },
    },
    senseService: {
      async getSenseById() {
        return duplicateCandidate;
      },
    },
  } as unknown as CliDependencies;

  const context: CliContext = {
    output: {
      writeData(text) {
        output.push(text);
      },
      writeError(text) {
        output.push(`error: ${text}`);
      },
    },
    terminalPrompt: {
      async readSecret() {
        return "";
      },
      async confirm() {
        confirmationRequested = true;
        return promptError ?? confirmation;
      },
    },
    async getDependencies() {
      return dependencies;
    },
    async getProviderDependencies() {
      return dependencies;
    },
  };

  return {
    context,
    errorEvents,
    output,
    get proposalInput() {
      return proposalInput;
    },
    get committedProposal() {
      return committedProposal;
    },
    get confirmationRequested() {
      return confirmationRequested;
    },
    get resolvedOverride() {
      return resolvedOverride;
    },
  };
}

async function runGenerate(
  context: CliContext,
  types = "definition",
  extraOptions: string[] = []
) {
  await createCliProgram(context).parseAsync(
    [
      "description",
      "generate",
      "source-1",
      "--instruction",
      "instruction-1",
      "--types",
      types,
      ...extraOptions,
    ],
    { from: "user" }
  );
}

afterEach(() => {
  process.exitCode = 0;
});

describe("description generate", () => {
  test("uses the Selected Model and parses unique Description Types", async () => {
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: null,
    });

    await runGenerate(fixture.context, "definition, example");

    expect(fixture.proposalInput).toMatchObject({
      sourceDescriptionId: "source-1",
      instructionId: "instruction-1",
      model: selectedModel,
      targetTypes: ["definition", "example"],
    });
    expect(fixture.resolvedOverride).toBeUndefined();
  });

  test("uses a one-command Model override", async () => {
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: null,
    });

    await runGenerate(fixture.context, "definition", [
      "--model",
      "google/gemini-2.5-flash",
    ]);

    expect(fixture.resolvedOverride).toBe("google/gemini-2.5-flash");
    expect(fixture.proposalInput).toMatchObject({
      model: { providerId: "google", modelId: "gemini-2.5-flash" },
    });

    await runGenerate(fixture.context);
    expect(fixture.proposalInput).toMatchObject({ model: selectedModel });
  });

  test.each([
    [
      "no selection",
      new ValidationError({
        reason: "Select a Model or supply an explicit Model override.",
      }),
      [],
    ],
    [
      "ineligible override",
      new ValidationError({
        reason:
          "Unknown or ineligible Model. Choose a listed Model or refresh the Model Catalog.",
      }),
      ["--model", "openai/retired"],
    ],
    [
      "missing Provider Connection",
      new NotFoundError({
        entity: "Configured Provider Connection; connect the Provider",
        id: "openai",
      }),
      [],
    ],
  ])(
    "rejects %s before generating",
    async (_name, selectionError, extraOptions) => {
      const fixture = createContext({
        confirmation: true,
        duplicateCandidate: null,
        selectionError,
      });

      await runGenerate(fixture.context, "definition", extraOptions);

      expect(fixture.output).toEqual([`error: ${selectionError.message}`]);
      expect(process.exitCode).toBe(3);
      expect(fixture.proposalInput).toBeNull();
      expect(fixture.committedProposal).toBeNull();
      expect(fixture.errorEvents[0]).toMatchObject({
        message: "CLI operation failed",
        error: selectionError,
        context: { operation: "description.generate", phase: "resolve" },
      });
    }
  );

  test("rejects duplicate Description Types without creating a proposal", async () => {
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: null,
    });

    await runGenerate(fixture.context, "definition,definition");

    expect(fixture.output).toEqual([
      "error: Invalid data: Description Types must be unique.",
    ]);
    expect(fixture.proposalInput).toBeNull();
  });

  test("logs a failed generation operation without changing its user-facing error", async () => {
    const generationError = new DescriptionGenerationError({
      operation: "request",
      reason: "Provider authentication failed. Replace the API key.",
      cause: new Error("Provider returned HTTP 401"),
    });
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: null,
      proposalError: generationError,
    });

    await runGenerate(fixture.context);

    expect(fixture.output).toEqual([`error: ${generationError.message}`]);
    expect(fixture.errorEvents[0]).toMatchObject({
      message: "CLI operation failed",
      error: generationError,
      context: {
        operation: "description.generate",
        phase: "proposal",
        sourceDescriptionId: "source-1",
        providerId: "openai",
        modelId: "model-1",
      },
    });
  });

  test("omits private database failure details from command logs", async () => {
    const databaseError = new DbError({
      operation: "find_source_description",
      reason: "Exception",
      cause: new Error("query failed with private Description text"),
    });
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: null,
      proposalError: databaseError,
    });

    await runGenerate(fixture.context);

    expect(fixture.output).toEqual([`error: ${databaseError.message}`]);
    expect(fixture.errorEvents[0]?.error).toBeInstanceOf(DbError);
    expect(fixture.errorEvents[0]?.error).not.toBe(databaseError);
    expect(JSON.stringify(fixture.errorEvents[0])).not.toContain(
      "private Description text"
    );
  });

  test("discards a suspected duplicate when declined at the terminal", async () => {
    const fixture = createContext({
      confirmation: false,
      duplicateCandidate: result.sense,
    });

    await runGenerate(fixture.context);

    expect(fixture.output).toEqual([
      "Suspected duplicate Sense: sense-2\tnew sense",
      "Proposed Sense: new sense",
      "definition\tgenerated definition",
      "Generation discarded",
    ]);
    expect(fixture.committedProposal).toBeNull();
  });

  test("commits a suspected duplicate when accepted at the terminal", async () => {
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: result.sense,
    });

    await runGenerate(fixture.context);

    expect(fixture.committedProposal).toEqual(proposal);
    expect(fixture.output).toEqual([
      "Suspected duplicate Sense: sense-2\tnew sense",
      "Proposed Sense: new sense",
      "definition\tgenerated definition",
      "sense-2",
      "description-2",
    ]);
  });

  test("refuses a suspected duplicate when terminal confirmation is unavailable", async () => {
    const promptError = new PromptError({ reason: "No interactive terminal" });
    const fixture = createContext({
      confirmation: false,
      duplicateCandidate: result.sense,
      promptError,
    });

    await runGenerate(fixture.context);

    expect(fixture.output).toContain(`error: ${promptError.message}`);
    expect(fixture.committedProposal).toBeNull();
    expect(process.exitCode).toBe(3);
  });

  test("allows a suspected duplicate without a terminal confirmation", async () => {
    const fixture = createContext({
      confirmation: false,
      duplicateCandidate: result.sense,
    });

    const program = createCliProgram(fixture.context);
    await program.parseAsync(
      [
        "description",
        "generate",
        "source-1",
        "--instruction",
        "instruction-1",
        "--types",
        "definition",
        "--allow-duplicate",
      ],
      { from: "user" }
    );

    expect(fixture.confirmationRequested).toBe(false);
    expect(fixture.committedProposal).toEqual(proposal);
  });

  test("removes terminal control characters from duplicate previews", async () => {
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: {
        ...result.sense,
        id: "sense\u001b[31m-2",
        name: "bad\nname",
      },
    });

    await runGenerate(fixture.context);

    expect(fixture.output).toContain(
      "Suspected duplicate Sense: sense[31m-2\tbadname"
    );
  });
});
