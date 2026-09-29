import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import { createCliContext } from "../app/context";
import { createCliProgram } from "../app/program";
import { CliExitCode } from "../app/types";
import { registerProviderCommands } from "./provider";

const originalDataHome = process.env.XDG_DATA_HOME;

afterEach(() => {
  process.exitCode = 0;
  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;
});

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-provider-cli-"));
  process.env.XDG_DATA_HOME = root;
  const context = createCliContext();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const prompts: string[] = [];
  const keys: string[] = [];
  context.output = {
    writeData: (text) => stdout.push(text),
    writeError: (text) => stderr.push(text),
  };
  context.terminalPrompt.readSecret = async (label) => {
    prompts.push(label);
    return keys.shift() ?? "";
  };

  return {
    root,
    stdout,
    stderr,
    prompts,
    keys,
    async run(...args: string[]) {
      stdout.length = 0;
      stderr.length = 0;
      process.exitCode = 0;
      const program = new Command().name("dictos").exitOverride();
      program.configureOutput({
        writeOut: (text) => stdout.push(text),
        writeErr: (text) => stderr.push(text),
      });
      registerProviderCommands(program, context);
      await program.parseAsync(["provider", ...args], { from: "user" });
      return process.exitCode ?? 0;
    },
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
    async assertNoDatabase() {
      if (!(await fs.readdir(root)).includes("dictos")) return;
      expect(await fs.readdir(path.join(root, "dictos"))).not.toContain(
        "dictos.db"
      );
    },
  };
}

describe("provider commands", () => {
  test("missing Provider IDs are usage errors without requesting a credential", async () => {
    const fixture = await createFixture();
    try {
      for (const action of ["connect", "reconnect", "disconnect"]) {
        expect(await fixture.run(action)).toBe(CliExitCode.UsageError);
        expect(fixture.stdout).toEqual([]);
        expect(fixture.stderr).toEqual([
          `provider ${action} requires <provider-id>`,
        ]);
      }
      expect(fixture.prompts).toEqual([]);
      await fixture.assertNoDatabase();
    } finally {
      await fixture.cleanup();
    }
  });

  test("obsolete provider commands and connection flags are rejected", async () => {
    const fixture = await createFixture();
    try {
      for (const action of ["presets", "models", "update", "delete"])
        await expect(fixture.run(action)).rejects.toMatchObject({
          code: "commander.unknownCommand",
        });
      await expect(
        fixture.run("connect", "google", "--name", "old")
      ).rejects.toMatchObject({ code: "commander.unknownOption" });
      expect(fixture.prompts).toEqual([]);
      await fixture.assertNoDatabase();
    } finally {
      await fixture.cleanup();
    }
  });

  test("lists supported IDs without configuring a connection or opening the Dictionary", async () => {
    const fixture = await createFixture();
    try {
      expect(await fixture.run("available")).toBe(CliExitCode.Success);
      expect(fixture.stdout).toEqual([
        "deepseek",
        "google",
        "groq",
        "openai",
        "openrouter",
      ]);
      expect(fixture.stderr).toEqual([]);
      expect(fixture.prompts).toEqual([]);
      await fixture.assertNoDatabase();
    } finally {
      await fixture.cleanup();
    }
  });

  test("connect and reconnect require valid status before hidden input and never expose keys", async () => {
    const fixture = await createFixture();
    try {
      fixture.keys.push("first-secret", "second-secret");
      expect(await fixture.run("connect", "unknown")).toBe(
        CliExitCode.ExpectedFailure
      );
      expect(await fixture.run("reconnect", "google")).toBe(
        CliExitCode.ExpectedFailure
      );
      expect(fixture.prompts).toEqual([]);

      expect(await fixture.run("connect", "google")).toBe(CliExitCode.Success);
      expect(fixture.stdout).toEqual(["google\tconfigured"]);
      expect(await fixture.run("connect", "google")).toBe(
        CliExitCode.ExpectedFailure
      );
      expect(fixture.stderr.join(" ")).toContain("Use reconnect");
      expect(fixture.prompts).toEqual(["API key: "]);
      expect(
        await fs.readFile(
          path.join(fixture.root, "dictos", "providers.json"),
          "utf8"
        )
      ).toContain("first-secret");
      expect(await fixture.run("list")).toBe(CliExitCode.Success);
      expect(fixture.stdout).toEqual(["google\tconfigured"]);

      expect(await fixture.run("reconnect", "google")).toBe(
        CliExitCode.Success
      );
      expect(fixture.prompts).toEqual(["API key: ", "API key: "]);
      expect(fixture.stdout).toEqual(["google\tconfigured"]);
      const dataDir = path.join(fixture.root, "dictos");
      const file = await fs.readFile(
        path.join(dataDir, "providers.json"),
        "utf8"
      );
      expect(file).toContain("second-secret");
      expect(file).not.toContain("first-secret");
      expect(
        (await fs.stat(path.join(dataDir, "providers.json"))).mode & 0o777
      ).toBe(0o600);
      expect([...fixture.stdout, ...fixture.stderr].join(" ")).not.toContain(
        "secret"
      );
      await fixture.assertNoDatabase();
    } finally {
      await fixture.cleanup();
    }
  });

  test("disconnect requires --yes, removes only the requested credential, and never opens the Dictionary", async () => {
    const fixture = await createFixture();
    try {
      fixture.keys.push("google-secret", "openai-secret");
      await fixture.run("connect", "google");
      await fixture.run("connect", "openai");
      expect(await fixture.run("disconnect", "google")).toBe(
        CliExitCode.UsageError
      );
      expect(fixture.stdout).toEqual([]);
      expect(fixture.stderr).toEqual([
        "Disconnecting a Provider requires --yes",
      ]);
      expect(await fixture.run("list")).toBe(CliExitCode.Success);
      expect(fixture.stdout).toEqual([
        "google\tconfigured",
        "openai\tconfigured",
      ]);
      expect(await fixture.run("disconnect", "google", "--yes")).toBe(
        CliExitCode.Success
      );
      expect(fixture.stdout).toEqual(["google\tdisconnected"]);
      expect(await fixture.run("list")).toBe(CliExitCode.Success);
      expect(fixture.stdout).toEqual(["openai\tconfigured"]);
      expect(await fixture.run("disconnect", "google", "--yes")).toBe(
        CliExitCode.ExpectedFailure
      );
      await fixture.assertNoDatabase();
    } finally {
      await fixture.cleanup();
    }
  });
});

test("provider, catalog, and selection commands work while another process holds the unmigrated Dictionary database", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-cli-locked-db-")
  );
  const dataDir = path.join(root, "dictos");
  await fs.mkdir(dataDir);
  process.env.XDG_DATA_HOME = root;
  const dbPath = path.join(dataDir, "dictos.db");
  const script = `
    import { connect } from "@tursodatabase/sync";
    const db = await connect({ path: process.argv[1], url: () => null, authToken: () => Promise.resolve("") });
    await db.exec("CREATE TABLE hold_marker (id INTEGER PRIMARY KEY)");
    const tablesBefore = await (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).all();
    const release = new Promise((resolve) => process.on("SIGUSR2", resolve));
    console.log("READY");
    await release;
    const tablesAfter = await (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).all();
    console.error(JSON.stringify({ before: tablesBefore, after: tablesAfter }));
    await db.close();
  `;
  const holder = Bun.spawn([process.execPath, "-e", script, dbPath], {
    cwd: new URL("../../../../packages/bun-turso-sync/", import.meta.url)
      .pathname,
    stdout: "pipe",
    stderr: "pipe",
  });
  const holderErrors = new Response(holder.stderr).text();
  const originalStderrWrite = process.stderr.write;
  const secret = "locked-db-test-secret";

  async function run(...args: string[]) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context = createCliContext();
    context.output = {
      writeData: (text) => stdout.push(text),
      writeError: (text) => stderr.push(text),
    };
    context.terminalPrompt.readSecret = async () => secret;
    process.stderr.write = ((text: string) => {
      stderr.push(text);
      return true;
    }) as typeof process.stderr.write;
    process.exitCode = 0;
    try {
      await createCliProgram(context).exitOverride().parseAsync(args, {
        from: "user",
      });
      return { stdout, stderr, exitCode: process.exitCode };
    } finally {
      process.stderr.write = originalStderrWrite;
    }
  }

  try {
    const startupTimeout = setTimeout(() => holder.kill(), 5000);
    const reader = holder.stdout.getReader();
    const readyChunk = await reader.read();
    reader.releaseLock();
    clearTimeout(startupTimeout);
    expect(new TextDecoder().decode(readyChunk.value).trim()).toBe("READY");
    expect(await fs.stat(dbPath)).toBeDefined();
    const databaseFiles = (await fs.readdir(dataDir)).filter((file) =>
      file.startsWith("dictos.db")
    );

    expect(await run("provider", "available")).toEqual({
      stdout: ["deepseek", "google", "groq", "openai", "openrouter"],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    expect(await run("provider", "list")).toEqual({
      stdout: [],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    expect(await run("model", "current")).toEqual({
      stdout: ["No Model selected."],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    expect(await run("provider", "connect", "google")).toEqual({
      stdout: ["google\tconfigured"],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    expect(await run("provider", "list")).toEqual({
      stdout: ["google\tconfigured"],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    const invalid = await run("model", "select", "google/not-listed");
    expect(invalid.stdout).toEqual([]);
    expect(invalid.stderr.join(" ")).toContain("refresh");
    expect(invalid.exitCode).toBe(CliExitCode.ExpectedFailure);
    const listed = await run("models", "google");
    expect(listed.exitCode).toBe(CliExitCode.Success);
    expect(listed.stdout.length).toBeGreaterThan(0);
    expect(listed.stdout).toEqual([...listed.stdout].sort());
    expect(listed.stdout.every((id) => id.startsWith("google/"))).toBe(true);
    expect(listed.stderr.join("")).toMatch(
      /Model Catalog: bundled \(\d{4}-\d{2}-\d{2}/
    );

    const selectedId = listed.stdout[0]!;
    expect(await run("model", "select", selectedId)).toEqual({
      stdout: [selectedId],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    expect(await run("model", "current")).toEqual({
      stdout: [selectedId],
      stderr: [],
      exitCode: CliExitCode.Success,
    });
    expect(JSON.stringify([listed, selectedId])).not.toContain(secret);
    expect(
      (await fs.readdir(dataDir)).filter((file) => file.startsWith("dictos.db"))
    ).toEqual(databaseFiles);
  } finally {
    process.stderr.write = originalStderrWrite;
    holder.kill("SIGUSR2");
    const timeout = setTimeout(() => holder.kill(), 5000);
    try {
      const exitCode = await holder.exited;
      const errors = await holderErrors;
      expect({ exitCode, errors }).toMatchObject({ exitCode: 0 });
      const schema = JSON.parse(errors.trim());
      expect(schema.before).toContainEqual({ name: "hold_marker" });
      expect(schema.after).toEqual(schema.before);
    } finally {
      clearTimeout(timeout);
      await fs.rm(root, { recursive: true, force: true });
    }
  }
}, 20000);
