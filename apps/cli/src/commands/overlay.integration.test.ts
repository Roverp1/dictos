import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "@dictos/errore";

import { BunTursoClient } from "@dictos/bun-turso-sync";
import {
  SqliteDescriptionRepository,
  SqliteEntryRepository,
} from "@dictos/db-core";
import type { Logger } from "@dictos/logger";
import { Command } from "commander";
import { createCliContext } from "../app/context";
import { registerOverlayCommands } from "./overlay";

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

test("overlay Save returns reviewed Entry IDs and writes the captured Description", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-overlay-cli-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const cli = path.join(import.meta.dir, "../index.ts");
  const child = Bun.spawn(
    [process.execPath, cli, "overlay", "save", "--json"],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, XDG_DATA_HOME: directory },
    }
  );
  child.stdin.write(
    JSON.stringify({
      kind: "entry",
      entryText: "czytać",
      descriptionText: "Czytam książkę.",
    }) + "\n"
  );
  child.stdin.end();

  const [stdout, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    child.exited,
  ]);
  expect(exitCode).toBe(0);
  const result = JSON.parse(stdout) as {
    ok: boolean;
    data: {
      entryId: string;
      capturedDescriptionId: string;
      senseId: string | null;
    };
  };
  expect(result.ok).toBe(true);
  expect(result.data.senseId).toBeNull();

  const client = await BunTursoClient.create(
    path.join(directory, "dictos", "dictos.db"),
    logger
  );
  cleanup.defer(async () => {
    const closed = await client.close();
    if (closed instanceof Error) throw closed;
  });
  const entry = await new SqliteEntryRepository(
    client.db,
    "test-device"
  ).findById(result.data.entryId);
  if (entry instanceof Error) throw entry;
  if (entry === null) throw new Error("Saved Entry is missing");
  const descriptions = await new SqliteDescriptionRepository(
    client.db
  ).findByEntry(entry.id);
  if (descriptions instanceof Error) throw descriptions;
  expect(entry.text).toBe("czytać");
  expect(
    descriptions.map(({ type, text, senseId }) => ({ type, text, senseId }))
  ).toEqual([{ type: "misc", text: "Czytam książkę.", senseId: null }]);
});

test("draft generation and Sense suggestions use edited input without opening the Dictionary", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-overlay-ai-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const oldDataHome = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = directory;
  cleanup.defer(() => {
    if (oldDataHome === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = oldDataHome;
    process.exitCode = 0;
  });
  const oldFetch = globalThis.fetch;
  const requestBodies: string[] = [];
  let output: object = {
    senses: [{ name: "reading", definition: "Interpret written text" }],
  };
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    requestBodies.push(String(init?.body));
    return Response.json({
      id: "completion",
      object: "chat.completion",
      created: 0,
      model: "fixture",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify(output),
          },
        },
      ],
    });
  }) as typeof fetch;
  cleanup.defer(() => {
    globalThis.fetch = oldFetch;
  });

  const context = createCliContext();
  const dependencies = await context.getProviderDependencies();
  if (dependencies instanceof Error) throw dependencies;
  const connected = await dependencies.providerConnectionService.connect({
    providerId: "openai",
    apiKey: "fixture-key",
  });
  if (connected instanceof Error) throw connected;
  const models = await dependencies.modelCatalogService.configuredModels({
    providerId: "openai",
  });
  if (models instanceof Error) throw models;
  const model = models[0];
  if (!model) throw new Error("No eligible OpenAI Model in bundled catalog");
  const selected = await dependencies.modelSelectionService.select(
    `openai/${model.modelId}`
  );
  if (selected instanceof Error) throw selected;
  const stdout: string[] = [];
  context.output = {
    writeData: (text) => {
      stdout.push(text);
    },
    writeError: () => {},
  };
  const input = {
    entryText: "read",
    descriptionText: "I read a book.",
    instructionText: "Odpowiedz po polsku.\nKrótko.",
  };
  const invoke = async (command: string, request: object) => {
    const program = new Command().exitOverride();
    registerOverlayCommands(program, context, {
      input: JSON.stringify(request) + "\n",
    });
    await program.parseAsync(["overlay", command, "--json"], { from: "user" });
    return JSON.parse(stdout.pop() ?? "null");
  };

  expect(await invoke("suggest", input)).toEqual({ ok: true, data: output });
  output = {
    descriptions: [{ type: "definition", text: "Odczytywać tekst." }],
  };
  expect(
    await invoke("generate", {
      ...input,
      senseName: "reading",
      descriptions: [],
      targetTypes: ["definition"],
    })
  ).toEqual({
    ok: true,
    data: {
      senseName: "reading",
      descriptions: [{ type: "definition", text: "Odczytywać tekst." }],
    },
  });
  expect(
    requestBodies.every((body) => body.includes("Odpowiedz po polsku"))
  ).toBe(true);
  expect(await fs.readdir(path.join(directory, "dictos"))).not.toContain(
    "dictos.db"
  );
});

test("missing Selected Model returns a handled error without creating Dictionary records", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-overlay-no-model-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(import.meta.dir, "../index.ts"),
      "overlay",
      "suggest",
      "--json",
    ],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, XDG_DATA_HOME: directory },
    }
  );
  child.stdin.write(
    JSON.stringify({
      entryText: "read",
      descriptionText: null,
      instructionText: "",
    }) + "\n"
  );
  child.stdin.end();
  const stdout = await new Response(child.stdout).text();
  expect(await child.exited).toBe(3);
  expect(JSON.parse(stdout).ok).toBe(false);
  expect(await fs.readdir(path.join(directory, "dictos"))).not.toContain(
    "dictos.db"
  );
});
