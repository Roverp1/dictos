import { afterEach, expect, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  AiSdkDescriptionGenerationAdapter,
  configureAiSdkWarningLogging,
  ModelCatalogAdapter,
} from "@dictos/ai-sdk";
import { BunTursoClient } from "@dictos/bun-turso-sync";
import {
  DescriptionGenerationService,
  DescriptionService,
  EntryService,
  FolderService,
  InstructionService,
  ModelCatalogService,
  ModelSelectionService,
  ProviderConnectionService,
  SenseService,
} from "@dictos/core";
import {
  SqliteDescriptionGenerationRepository,
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteInstructionRepository,
  SqliteSenseRepository,
} from "@dictos/db-core";
import {
  FsLocalStateRepository,
  FsModelCatalogStore,
  FsProviderConnectionRepository,
} from "@dictos/fs-storage";
import type { Context, Logger } from "@dictos/logger";

import { PromptError } from "../app/errors";
import { createCliProgram } from "../app/program";
import {
  CliExitCode,
  type CliContext,
  type CliDependencies,
} from "../app/types";

const secret = "integration-secret-never-print";

type Reply = (url: string, init: RequestInit) => Promise<Response>;

function proposal({
  candidate = null,
  text = "generated translation",
}: { candidate?: string | null; text?: string } = {}) {
  return {
    senseName: "generated Sense",
    duplicateCandidateSenseId: candidate,
    descriptions: [{ type: "translation", text }],
  };
}

function success(
  url: string,
  init: RequestInit,
  content: unknown = proposal()
) {
  if (url.includes("generativelanguage.googleapis.com"))
    return Response.json({
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: JSON.stringify(content) }],
          },
          finishReason: "STOP",
        },
      ],
    });
  const body = JSON.parse(String(init.body)) as { model: string };
  return Response.json({
    id: "completion-1",
    object: "chat.completion",
    created: 0,
    model: body.model,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify(content) },
      },
    ],
  });
}

async function fixture() {
  const errorEvents: { message: string; error: unknown; context?: Context }[] =
    [];
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
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-description-integration-")
  );
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    logger
  );
  const restoreWarnings = configureAiSdkWarningLogging(logger);
  const db = client.db;
  const entries = new EntryService(
    new SqliteEntryRepository(db, crypto.randomUUID())
  );
  const folders = new FolderService(new SqliteFolderRepository(db));
  const descriptionRepo = new SqliteDescriptionRepository(db);
  const senseRepo = new SqliteSenseRepository(db);
  const instructions = new InstructionService(
    new SqliteInstructionRepository(db)
  );
  const descriptions = new DescriptionService(descriptionRepo, senseRepo);
  const senses = new SenseService(senseRepo);
  const connections = new FsProviderConnectionRepository({
    dataDir: directory,
    logger,
  });
  const state = new FsLocalStateRepository(directory);
  const catalog = new ModelCatalogAdapter({
    store: new FsModelCatalogStore({ dataDir: directory }),
    logger,
    fetchImplementation: async () => {
      throw new Error("Unexpected catalog HTTP request");
    },
  });
  const catalogService = new ModelCatalogService(catalog, connections);
  const selection = new ModelSelectionService(
    catalogService,
    connections,
    state
  );
  const providerConnections = new ProviderConnectionService(
    connections,
    catalogService,
    state
  );
  const requests: { url: string; body: string }[] = [];
  let reply: Reply = async (url, init) => success(url, init);
  const generation = new DescriptionGenerationService(
    descriptionRepo,
    new SqliteEntryRepository(db, crypto.randomUUID()),
    new SqliteInstructionRepository(db),
    connections,
    catalogService,
    senseRepo,
    new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (input, init) => {
        const url = String(input);
        requests.push({ url, body: String(init?.body) });
        return reply(url, init ?? {});
      },
    }),
    new SqliteDescriptionGenerationRepository(db)
  );
  const root = await folders.getRootFolder();
  if (root instanceof Error) throw root;
  const entry = await entries.createEntry({ folderId: root.id, text: "hello" });
  if (entry instanceof Error) throw entry;
  const source = await descriptions.createDescription({
    entryId: entry.id,
    type: "misc",
    text: "source Description",
  });
  if (source instanceof Error) throw source;
  const instruction = await instructions.createInstruction({
    text: "Translate the source Description",
  });
  if (instruction instanceof Error) throw instruction;
  const sourceId = source.id;
  const entryId = entry.id;
  const instructionId = instruction.id;
  const bundled = await catalog.get();
  if (bundled instanceof Error) throw bundled;
  const models = Object.fromEntries(
    ["openai", "google", "deepseek"].map((providerId) => {
      const model = bundled.models.find(
        (item) =>
          item.providerId === providerId &&
          item.status === "active" &&
          item.inputModalities.includes("text") &&
          item.outputModalities.includes("text") &&
          item.protocol === undefined
      );
      if (!model) throw new Error(`No eligible bundled ${providerId} Model`);
      return [providerId, `${providerId}/${model.modelId}`];
    })
  ) as Record<"openai" | "google" | "deepseek", string>;
  for (const providerId of ["openai", "google", "deepseek"]) {
    const connected = await providerConnections.connect({
      providerId,
      apiKey: secret,
    });
    if (connected instanceof Error) throw connected;
  }

  const dependencies = {
    logger,
    entryService: entries,
    folderService: folders,
    descriptionService: descriptions,
    senseService: senses,
    instructionService: instructions,
    descriptionGenerationService: generation,
    providerConnectionService: providerConnections,
    modelCatalog: catalog,
    modelCatalogService: catalogService,
    modelSelectionService: selection,
  } as unknown as CliDependencies;
  const stdout: string[] = [];
  const stderr: string[] = [];
  let confirmation: boolean | PromptError = false;
  const context: CliContext = {
    output: {
      writeData: (text) => stdout.push(text),
      writeError: (text) => stderr.push(text),
    },
    terminalPrompt: {
      readSecret: async () => secret,
      confirm: async () => confirmation,
    },
    getDependencies: async () => dependencies,
    getProviderDependencies: async () => dependencies,
  };

  async function run(args: string[]) {
    stdout.length = 0;
    stderr.length = 0;
    process.exitCode = 0;
    await createCliProgram(context)
      .exitOverride()
      .parseAsync(args, { from: "user" });
    return {
      stdout: [...stdout],
      stderr: [...stderr],
      exitCode: process.exitCode,
    };
  }

  async function generate(options: string[] = []) {
    return run([
      "description",
      "generate",
      sourceId,
      "--instruction",
      instructionId,
      "--types",
      "translation",
      ...options,
    ]);
  }

  async function dictionary() {
    const currentSource = await descriptions.getDescriptionById(sourceId);
    if (currentSource instanceof Error) throw currentSource;
    const entrySenses = await senses.getSensesForEntry(entryId);
    if (entrySenses instanceof Error) throw entrySenses;
    const entryDescriptions =
      await descriptions.getDescriptionsForEntry(entryId);
    if (entryDescriptions instanceof Error) throw entryDescriptions;
    return { currentSource, entrySenses, entryDescriptions };
  }

  return {
    models,
    source,
    entry,
    senses,
    descriptions,
    selection,
    requests,
    errorEvents,
    generate,
    run,
    dictionary,
    setReply: (value: Reply) => {
      reply = value;
    },
    setConfirmation: (value: boolean | PromptError) => {
      confirmation = value;
    },
    catalog,
    directory,
    async cleanup() {
      restoreWarnings();
      const closed = await client.close();
      if (closed instanceof Error) throw closed;
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}

afterEach(() => {
  process.exitCode = 0;
});

test("Selected Model generates through native OpenAI and commits the whole proposal", async () => {
  const f = await fixture();
  try {
    expect((await f.run(["model", "select", f.models.openai])).exitCode).toBe(
      0
    );
    const result = await f.generate();
    const saved = await f.dictionary();
    expect(result).toMatchObject({ exitCode: 0, stderr: [] });
    expect(result.stdout).toEqual([
      saved.entrySenses[0]!.id,
      saved.entryDescriptions.find((item) => item.id !== f.source.id)!.id,
    ]);
    expect(saved.entrySenses).toMatchObject([{ name: "generated Sense" }]);
    expect(saved.currentSource?.senseId).toBe(saved.entrySenses[0]?.id);
    expect(saved.entryDescriptions).toContainEqual(
      expect.objectContaining({
        type: "translation",
        text: "generated translation",
        senseId: saved.entrySenses[0]?.id,
      })
    );
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]?.url).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
    expect(JSON.parse(f.requests[0]!.body)).toMatchObject({
      model: f.models.openai.slice("openai/".length),
      response_format: { type: "json_schema" },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  } finally {
    await f.cleanup();
  }
});

test("one-command compatible override does not replace the Selected Model", async () => {
  const f = await fixture();
  try {
    expect((await f.run(["model", "select", f.models.openai])).exitCode).toBe(
      0
    );
    const override = await f.generate(["--model", f.models.deepseek]);
    expect(override.exitCode).toBe(0);
    expect(f.requests[0]?.url).toBe(
      "https://api.deepseek.com/v1/chat/completions"
    );
    expect(JSON.parse(f.requests[0]!.body)).toMatchObject({
      model: f.models.deepseek.slice("deepseek/".length),
      response_format: { type: "json_object" },
    });
    expect(await f.run(["model", "current"])).toEqual({
      stdout: [f.models.openai],
      stderr: [],
      exitCode: 0,
    });
    expect((await f.generate()).exitCode).toBe(0);
    expect(f.requests.map((request) => request.url)).toEqual([
      "https://api.deepseek.com/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
    ]);
    const saved = await f.dictionary();
    expect(saved.entrySenses).toHaveLength(1);
    expect(saved.entryDescriptions).toHaveLength(3);
  } finally {
    await f.cleanup();
  }
});

test("native Google accepts a nullable duplicate candidate", async () => {
  const f = await fixture();
  try {
    const result = await f.generate(["--model", f.models.google]);
    expect(result.exitCode).toBe(0);
    expect(f.requests[0]?.url).toContain("generativelanguage.googleapis.com");
    expect(JSON.parse(f.requests[0]!.body)).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
    expect((await f.dictionary()).entryDescriptions).toHaveLength(2);
  } finally {
    await f.cleanup();
  }
});

test("duplicate discard leaves the Dictionary untouched; acceptance commits once", async () => {
  const f = await fixture();
  try {
    const existing = await f.senses.createSense({
      entryId: f.entry.id,
      name: "existing Sense",
    });
    if (existing instanceof Error) throw existing;
    const before = await f.dictionary();
    f.setReply(async (url, init) =>
      success(url, init, proposal({ candidate: existing.id }))
    );
    f.setConfirmation(false);
    const discarded = await f.generate(["--model", f.models.openai]);
    expect(discarded.exitCode).toBe(0);
    expect(discarded.stdout).toContain("Generation discarded");
    expect(await f.dictionary()).toEqual(before);

    f.setConfirmation(true);
    const accepted = await f.generate(["--model", f.models.openai]);
    const saved = await f.dictionary();
    expect(accepted.exitCode).toBe(0);
    expect(saved.entrySenses).toHaveLength(2);
    expect(saved.entryDescriptions).toHaveLength(2);
    expect(saved.currentSource?.senseId).toBe(
      saved.entrySenses.find((sense) => sense.id !== existing.id)?.id
    );
    expect(f.requests).toHaveLength(2);
  } finally {
    await f.cleanup();
  }
});

test("non-interactive duplicate confirmation refuses a write unless explicitly allowed", async () => {
  const f = await fixture();
  try {
    const existing = await f.senses.createSense({
      entryId: f.entry.id,
      name: "existing Sense",
    });
    if (existing instanceof Error) throw existing;
    const before = await f.dictionary();
    f.setReply(async (url, init) =>
      success(url, init, proposal({ candidate: existing.id }))
    );
    f.setConfirmation(new PromptError({ reason: "No interactive terminal" }));
    const refused = await f.generate(["--model", f.models.openai]);
    expect(refused.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(await f.dictionary()).toEqual(before);
    const allowed = await f.generate([
      "--model",
      f.models.openai,
      "--allow-duplicate",
    ]);
    expect(allowed.exitCode).toBe(0);
    expect((await f.dictionary()).entryDescriptions).toHaveLength(2);
    expect(f.requests).toHaveLength(2);
  } finally {
    await f.cleanup();
  }
});

test("invalid Model choices fail without a provider request or Dictionary write", async () => {
  const f = await fixture();
  try {
    const before = await f.dictionary();
    for (const options of [
      [],
      ["--model", "openai/not-in-catalog"],
      ["--model", "bad-model"],
    ]) {
      const result = await f.generate(options);
      expect(result.exitCode).toBe(CliExitCode.ExpectedFailure);
      expect(result.stdout).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(await f.dictionary()).toEqual(before);
    }
    expect(f.requests).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("duplicate Description Types fail before provider HTTP or Dictionary writes", async () => {
  const f = await fixture();
  try {
    const before = await f.dictionary();
    const result = await f.generate([
      "--model",
      f.models.openai,
      "--types",
      "translation,translation",
    ]);
    expect(result).toEqual({
      stdout: [],
      stderr: ["Invalid data: Description Types must be unique."],
      exitCode: CliExitCode.ExpectedFailure,
    });
    expect(f.requests).toHaveLength(0);
    expect(await f.dictionary()).toEqual(before);
  } finally {
    await f.cleanup();
  }
});

test("duplicate preview strips terminal control characters from Sense and Description text", async () => {
  const f = await fixture();
  try {
    const existing = await f.senses.createSense({
      entryId: f.entry.id,
      name: "bad\n\u001b[31mname",
    });
    if (existing instanceof Error) throw existing;
    const before = await f.dictionary();
    f.setReply(async (url, init) =>
      success(url, init, {
        senseName: "new\rSense",
        duplicateCandidateSenseId: existing.id,
        descriptions: [
          { type: "translation", text: "generated\u001b[31m\ntext" },
        ],
      })
    );
    f.setConfirmation(false);
    const result = await f.generate(["--model", f.models.openai]);
    expect(result).toEqual({
      stdout: [
        `Suspected duplicate Sense: ${existing.id}\tbad[31mname`,
        "Proposed Sense: newSense",
        "translation\tgenerated[31mtext",
        "Generation discarded",
      ],
      stderr: [],
      exitCode: 0,
    });
    expect(await f.dictionary()).toEqual(before);
  } finally {
    await f.cleanup();
  }
});

test("provider authentication failure keeps CLI output and logs free of credentials", async () => {
  const f = await fixture();
  try {
    const before = await f.dictionary();
    f.setReply(async () =>
      Response.json({ error: { message: secret } }, { status: 401 })
    );
    const result = await f.generate(["--model", f.models.openai]);
    expect(result).toEqual({
      stdout: [],
      stderr: [
        "Description Generation request failed: Provider authentication failed. Replace the API key.",
      ],
      exitCode: CliExitCode.ExpectedFailure,
    });
    expect(f.errorEvents).toContainEqual(
      expect.objectContaining({
        message: "CLI operation failed",
        context: expect.objectContaining({
          operation: "description.generate",
          phase: "proposal",
        }),
      })
    );
    expect(
      JSON.stringify(
        f.errorEvents.map((event) => ({
          ...event,
          error:
            event.error instanceof Error
              ? {
                  message: event.error.message,
                  cause:
                    event.error.cause instanceof Error
                      ? event.error.cause.message
                      : event.error.cause,
                }
              : event.error,
        }))
      )
    ).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(await f.dictionary()).toEqual(before);
  } finally {
    await f.cleanup();
  }
});

test("a stale Selected Model fails before provider HTTP and keeps the Dictionary unchanged", async () => {
  const f = await fixture();
  try {
    expect((await f.run(["model", "select", f.models.openai])).exitCode).toBe(
      0
    );
    const before = await f.dictionary();
    const catalog = await f.catalog.get();
    if (catalog instanceof Error) throw catalog;
    const stored = await new FsModelCatalogStore({
      dataDir: f.directory,
    }).replace({
      ...catalog,
      fetchedAt: "2026-09-28T00:00:00.000Z",
      models: catalog.models.filter(
        (item) => `${item.providerId}/${item.modelId}` !== f.models.openai
      ),
    });
    if (stored instanceof Error) throw stored;
    const result = await f.generate();
    expect(result.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(result.stderr.join(" ")).toContain("refresh");
    expect(f.requests).toHaveLength(0);
    expect(await f.dictionary()).toEqual(before);
  } finally {
    await f.cleanup();
  }
});

test("provider rejection and invalid output leave no partial Dictionary write", async () => {
  const f = await fixture();
  try {
    const before = await f.dictionary();
    f.setReply(async () =>
      Response.json({ error: { message: secret } }, { status: 401 })
    );
    const rejected = await f.generate(["--model", f.models.openai]);
    expect(rejected.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(rejected.stderr.join(" ")).toContain("authentication");
    expect(await f.dictionary()).toEqual(before);

    f.setReply(async (url, init) => success(url, init, proposal({ text: "" })));
    const invalidContent = await f.generate(["--model", f.models.openai]);
    expect(invalidContent.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(await f.dictionary()).toEqual(before);

    f.setReply(async (url, init) =>
      success(url, init, { ...proposal(), duplicateCandidateSenseId: 123 })
    );
    const malformed = await f.generate(["--model", f.models.openai]);
    expect(malformed.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(await f.dictionary()).toEqual(before);
    expect(f.requests).toHaveLength(3);
    expect(JSON.stringify([rejected, invalidContent, malformed])).not.toContain(
      secret
    );
  } finally {
    await f.cleanup();
  }
});

test("a source Description changed during provider HTTP cannot be partially committed", async () => {
  const f = await fixture();
  try {
    const otherSense = await f.senses.createSense({
      entryId: f.entry.id,
      name: "changed Sense",
    });
    if (otherSense instanceof Error) throw otherSense;
    f.setReply(async (url, init) => {
      const changed = await f.descriptions.assignToSense({
        descriptionId: f.source.id,
        senseId: otherSense.id,
      });
      if (changed instanceof Error) throw changed;
      return success(url, init);
    });
    const result = await f.generate(["--model", f.models.openai]);
    const saved = await f.dictionary();
    expect(result.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(result.stderr.join(" ")).toContain("changed");
    expect(saved.entrySenses).toEqual([otherSense]);
    expect(saved.currentSource?.senseId).toBe(otherSense.id);
    expect(saved.entryDescriptions).toHaveLength(1);
    expect(f.requests).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
