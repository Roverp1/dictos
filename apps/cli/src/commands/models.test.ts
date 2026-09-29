import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { FsModelCatalogStore } from "@dictos/fs-storage";

import { createCliContext } from "../app/context";
import { registerModelsCommands } from "./models";

const originalDataHome = process.env.XDG_DATA_HOME;
const originalFetch = globalThis.fetch;
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;

afterEach(() => {
  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  process.exitCode = 0;
});

async function withCli(
  run: (fixture: {
    context: ReturnType<typeof createCliContext>;
    invoke: (...args: string[]) => Promise<void>;
    stdout: string[];
    stderr: string[];
    dataDir: string;
  }) => Promise<void>
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-models-cli-"));
  process.env.XDG_DATA_HOME = root;
  const stdout: string[] = [];
  const stderr: string[] = [];
  process.stdout.write = ((text: string) => {
    stdout.push(text);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((text: string) => {
    stderr.push(text);
    return true;
  }) as typeof process.stderr.write;
  const context = createCliContext();
  const program = new Command().name("dictos").exitOverride();
  registerModelsCommands(program, context);
  try {
    await run({
      context,
      invoke: async (...args) => {
        await program.parseAsync(["models", ...args], { from: "user" });
      },
      stdout,
      stderr,
      dataDir: path.join(root, "dictos"),
    });
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("offline listing shows sorted configured Model IDs and catalog provenance without a database", async () => {
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    throw new Error("Unexpected HTTP request");
  }) as unknown as typeof fetch;
  await withCli(async ({ context, invoke, stdout, stderr, dataDir }) => {
    const deps = await context.getProviderDependencies();
    if (deps instanceof Error) throw deps;
    for (const providerId of ["openai", "google"]) {
      const connected = await deps.providerConnectionService.connect({
        providerId,
        apiKey: "secret",
      });
      if (connected instanceof Error) throw connected;
    }
    await invoke();
    const ids = stdout.join("").trim().split("\n");
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual([...ids].sort());
    expect(
      ids.every((id) => id.startsWith("google/") || id.startsWith("openai/"))
    ).toBe(true);
    expect(stderr.join("")).toContain("bundled");
    expect(stderr.join("")).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(await fs.readdir(dataDir)).not.toContain("dictos.db");
    expect(requests).toBe(0);
    expect(process.exitCode ?? 0).toBe(0);
  });
});

test("embedding-only Models are not listed or selectable despite text modalities", async () => {
  await withCli(async ({ context, invoke, stdout }) => {
    const dependencies = await context.getProviderDependencies();
    if (dependencies instanceof Error) throw dependencies;
    for (const providerId of ["openai", "google"]) {
      const connected = await dependencies.providerConnectionService.connect({
        providerId,
        apiKey: "private-key",
      });
      if (connected instanceof Error) throw connected;
    }

    await invoke();
    const listing = stdout.join("");
    expect(listing).not.toContain("google/gemini-embedding-001");
    expect(listing).not.toContain("openai/text-embedding-3-large");
    expect(
      await dependencies.modelCatalogService.requireEligibleModel(
        "google/gemini-embedding-001"
      )
    ).toBeInstanceOf(Error);
    expect(
      await dependencies.modelCatalogService.requireEligibleModel(
        "openai/text-embedding-3-large"
      )
    ).toBeInstanceOf(Error);
  });
});

test("unknown Provider fails without printing Model IDs", async () => {
  await withCli(async ({ invoke, stdout, stderr }) => {
    await invoke("not-supported");
    expect(stdout).toEqual([]);
    expect(stderr.join("")).toContain("Unknown Provider ID");
    expect(process.exitCode).toBe(3);
  });
});

test("refresh saves eligible Models and verbose offline listing shows validated metadata", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        deepseek: { id: "deepseek", name: "DeepSeek", models: {} },
        google: {
          id: "google",
          name: "Google",
          models: {
            "z/model": {
              id: "z/model",
              name: "Z Model",
              temperature: true,
              modalities: { input: ["text"], output: ["text"] },
            },
            "a-model": {
              id: "a-model",
              name: "A Model",
              status: "beta",
              tool_call: true,
              cost: { input: 1.5, output: 2 },
              modalities: { input: ["text"], output: ["text"] },
            },
            "image-only": {
              id: "image-only",
              name: "Image",
              modalities: { input: ["image"], output: ["image"] },
            },
            hostile: {
              id: "hostile",
              name: "\u001b[31msecret",
              structured_output: true,
              modalities: { input: ["text"], output: ["text"] },
            },
          },
        },
        groq: { id: "groq", name: "Groq", models: {} },
        openai: { id: "openai", name: "OpenAI", models: {} },
        openrouter: { id: "openrouter", name: "OpenRouter", models: {} },
      }),
      { status: 200 }
    )) as unknown as typeof fetch;
  await withCli(async ({ context, invoke, stdout, stderr, dataDir }) => {
    const deps = await context.getProviderDependencies();
    if (deps instanceof Error) throw deps;
    const connected = await deps.providerConnectionService.connect({
      providerId: "google",
      apiKey: "private-key",
    });
    if (connected instanceof Error) throw connected;
    await invoke("google", "--refresh", "--verbose");
    expect(stdout).toEqual([
      "google/a-model\tA Model\tbeta\t1.5\t2\n",
      "google/z/model\tZ Model\tactive\t-\t-\n",
    ]);
    expect(stderr.join("")).toContain("cache");
    expect(await fs.readdir(dataDir)).not.toContain("dictos.db");

    stdout.length = 0;
    stderr.length = 0;
    await invoke("google");
    expect(stdout).toEqual(["google/a-model\n", "google/z/model\n"]);
    expect(stderr.join("")).toContain("cache");
    expect(process.exitCode ?? 0).toBe(0);
  });
});

test("failed explicit refresh reports exit 3 and does not print stale cached IDs", async () => {
  globalThis.fetch = (async () =>
    new Response("offline", { status: 503 })) as unknown as typeof fetch;
  await withCli(async ({ context, invoke, stdout, stderr, dataDir }) => {
    const deps = await context.getProviderDependencies();
    if (deps instanceof Error) throw deps;
    const connected = await deps.providerConnectionService.connect({
      providerId: "google",
      apiKey: "private-key",
    });
    if (connected instanceof Error) throw connected;
    const stored = await new FsModelCatalogStore({ dataDir }).replace({
      source: "cache",
      fetchedAt: "2026-09-01T00:00:00.000Z",
      providers: [{ id: "google", name: "Google" }],
      models: [
        {
          providerId: "google",
          modelId: "cached-model",
          name: "Cached Model",
          textGeneration: true,
          status: "active",
          inputModalities: ["text"],
          outputModalities: ["text"],
        },
      ],
    });
    if (stored instanceof Error) throw stored;

    await invoke("--refresh");
    expect(stdout).toEqual([]);
    expect(stderr.join("")).toContain("Catalog request failed");
    expect(stderr.join("")).not.toContain("private-key");
    expect(process.exitCode).toBe(3);

    process.exitCode = 0;
    stderr.length = 0;
    await invoke("google");
    expect(stdout.length).toBeGreaterThan(0);
    expect(stderr.join("")).toContain("cache");
  });
});

test("v1 Model Catalog cache falls back to bundled Models without leaking cached data", async () => {
  await withCli(async ({ context, invoke, stdout, stderr, dataDir }) => {
    const deps = await context.getProviderDependencies();
    if (deps instanceof Error) throw deps;
    const connected = await deps.providerConnectionService.connect({
      providerId: "google",
      apiKey: "private-key",
    });
    if (connected instanceof Error) throw connected;

    await fs.writeFile(
      path.join(dataDir, "model-catalog.json"),
      JSON.stringify({
        version: 1,
        fetchedAt: "2026-09-01T00:00:00.000Z",
        providers: [{ id: "google", name: "Google" }],
        models: [
          {
            providerId: "google",
            modelId: "legacy-model",
            name: "\u001b[31mprivate-key",
            status: "active",
            inputModalities: ["text"],
            outputModalities: ["text"],
          },
        ],
      })
    );

    await invoke("google");
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout.join("")).not.toContain("legacy-model");
    expect(stderr.join("")).toContain("Model Catalog: bundled");
    expect(stderr.join("")).not.toContain("private-key");
    expect(stderr.join("")).not.toContain("\u001b");
    const log = await fs.readFile(path.join(dataDir, "dictos-cli.log"), "utf8");
    expect(log).toContain("Model Catalog cache invalid; using bundled catalog");
    expect(log).not.toContain("private-key");
    expect(log).not.toContain("\u001b");
    expect(process.exitCode ?? 0).toBe(0);
  });
});
