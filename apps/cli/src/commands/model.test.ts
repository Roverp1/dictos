import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import {
  FsModelCatalogStore,
  FsProviderConnectionRepository,
} from "@dictos/fs-storage";

import { createCliContext } from "../app/context";
import { CliExitCode } from "../app/types";
import { registerModelCommands } from "./model";

const originalDataHome = process.env.XDG_DATA_HOME;

afterEach(() => {
  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;
  process.exitCode = 0;
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-cli-model-"));
  process.env.XDG_DATA_HOME = root;
  const dataDir = path.join(root, "dictos");
  const context = createCliContext();
  const dependencies = await context.getProviderDependencies();
  if (dependencies instanceof Error) throw dependencies;
  const catalog = await dependencies.modelCatalog.get();
  if (catalog instanceof Error) throw catalog;
  const model = catalog.models.find(
    (item) =>
      item.providerId === "google" &&
      item.status === "active" &&
      item.inputModalities.includes("text") &&
      item.outputModalities.includes("text") &&
      item.protocol === undefined
  );
  if (!model) throw new Error("Bundled catalog needs an eligible Google Model");
  const id = `${model.providerId}/${model.modelId}`;
  const secret = "test-secret-never-print-this";

  async function run(args: string[]) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const commandContext = createCliContext();
    commandContext.output = {
      writeData: (text) => stdout.push(text),
      writeError: (text) => stderr.push(text),
    };
    process.exitCode = 0;
    const program = new Command().name("dictos").exitOverride();
    registerModelCommands(program, commandContext);
    await program.parseAsync(["model", ...args], { from: "user" });
    return { stdout, stderr, exitCode: process.exitCode };
  }

  return {
    dataDir,
    dependencies,
    id,
    secret,
    run,
    async connect() {
      const result = await dependencies.providerConnectionService.connect({
        providerId: "google",
        apiKey: secret,
      });
      if (result instanceof Error) throw result;
    },
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

test("model current reports an unselected device without opening the Dictionary", async () => {
  const f = await fixture();
  try {
    expect(await f.run(["current"])).toEqual({
      stdout: ["No Model selected."],
      stderr: [],
      exitCode: 0,
    });
    expect(await fs.readdir(f.dataDir)).not.toContain("dictos.db");
  } finally {
    await f.cleanup();
  }
});

test("model select persists a safe qualified ID across CLI invocations", async () => {
  const f = await fixture();
  try {
    await f.connect();
    expect(await f.run(["select", f.id])).toEqual({
      stdout: [f.id],
      stderr: [],
      exitCode: 0,
    });
    expect(await f.run(["current"])).toEqual({
      stdout: [f.id],
      stderr: [],
      exitCode: 0,
    });
    expect(await fs.readdir(f.dataDir)).not.toContain("dictos.db");
    const state = await fs.readFile(
      path.join(f.dataDir, "local-state.json"),
      "utf8"
    );
    expect(state).not.toContain(f.secret);
  } finally {
    await f.cleanup();
  }
});

test("model select rejects missing connections and ineligible IDs without leaking credentials", async () => {
  const f = await fixture();
  try {
    const missing = await f.run(["select", f.id]);
    expect(missing.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(missing.stdout).toEqual([]);
    expect(missing.stderr.join(" ")).toContain("Provider Connection");

    await f.connect();
    const invalid = await f.run(["select", "google/not-a-listed-model"]);
    expect(invalid.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(invalid.stdout).toEqual([]);
    expect(invalid.stderr.join(" ")).toContain("refresh");
    expect(JSON.stringify([missing, invalid])).not.toContain(f.secret);
    expect(JSON.stringify([missing, invalid])).not.toContain("dictos.db");
    expect(await f.run(["current"])).toMatchObject({
      stdout: ["No Model selected."],
      exitCode: 0,
    });
  } finally {
    await f.cleanup();
  }
});

test("model current reports a missing connection instead of falling back", async () => {
  const f = await fixture();
  try {
    await f.connect();
    expect((await f.run(["select", f.id])).exitCode).toBe(0);
    const repo = new FsProviderConnectionRepository({
      dataDir: f.dataDir,
      logger: f.dependencies.logger,
    });
    const removed = await repo.delete("google");
    if (removed instanceof Error) throw removed;
    expect(removed).not.toBeNull();

    const current = await f.run(["current"]);
    expect(current.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(current.stdout).toEqual([]);
    expect(current.stderr.join(" ")).toContain("Provider Connection");
    expect(JSON.stringify(current)).not.toContain(f.secret);
  } finally {
    await f.cleanup();
  }
});

test("model current rejects a saved Model removed from the catalog", async () => {
  const f = await fixture();
  try {
    await f.connect();
    expect((await f.run(["select", f.id])).exitCode).toBe(0);
    const catalog = await f.dependencies.modelCatalog.get();
    if (catalog instanceof Error) throw catalog;
    const store = new FsModelCatalogStore({ dataDir: f.dataDir });
    const saved = await store.replace({
      ...catalog,
      fetchedAt: new Date().toISOString(),
      models: catalog.models.filter(
        (model) => `${model.providerId}/${model.modelId}` !== f.id
      ),
    });
    if (saved instanceof Error) throw saved;

    const current = await f.run(["current"]);
    expect(current.exitCode).toBe(CliExitCode.ExpectedFailure);
    expect(current.stdout).toEqual([]);
    expect(current.stderr.join(" ")).toContain("refresh");
    expect(JSON.stringify(current)).not.toContain(f.secret);
    expect(JSON.stringify(current)).not.toContain("dictos.db");
  } finally {
    await f.cleanup();
  }
});
