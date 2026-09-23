import { afterEach, describe, expect, test } from "bun:test";
import type {
  DescriptionGenerationProposal,
  DescriptionGenerationResult,
  DescriptionGenerationService,
  Sense,
} from "@dictos/core";

import { createCliProgram } from "../app/program";
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

function createContext({
  confirmation,
  duplicateCandidate,
}: {
  confirmation: boolean;
  duplicateCandidate: Sense | null;
}) {
  const output: string[] = [];
  let proposalInput: ProposalInput | null = null;
  let committedProposal: DescriptionGenerationProposal | null = null;
  let confirmationRequested = false;

  const dependencies = {
    descriptionGenerationService: {
      async createProposal(input: ProposalInput) {
        proposalInput = input;
        return proposal;
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
        return confirmation;
      },
    },
    async getDependencies() {
      return dependencies;
    },
  };

  return {
    context,
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
  };
}

async function runGenerate(context: CliContext, types = "definition") {
  await createCliProgram(context).parseAsync(
    [
      "description",
      "generate",
      "source-1",
      "--instruction",
      "instruction-1",
      "--provider",
      "provider-1",
      "--model",
      "model-1",
      "--types",
      types,
    ],
    { from: "user" }
  );
}

afterEach(() => {
  process.exitCode = 0;
});

describe("description generate", () => {
  test("parses unique requested Description Types before creating a proposal", async () => {
    const fixture = createContext({
      confirmation: true,
      duplicateCandidate: null,
    });

    await runGenerate(fixture.context, "definition, example");

    expect(fixture.proposalInput).toMatchObject({
      sourceDescriptionId: "source-1",
      instructionId: "instruction-1",
      providerConnectionId: "provider-1",
      modelId: "model-1",
      targetTypes: ["definition", "example"],
    });
  });

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
        "--provider",
        "provider-1",
        "--model",
        "model-1",
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
