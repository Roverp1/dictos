import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { isolatedCli } from "./cli-fixture";
import { FsLocalStateRepository } from "@dictos/fs-storage";

const guardedActions = [
  {
    name: "provider disconnect confirmation",
    args: ["provider", "disconnect", "openai"],
    exit: 2,
    message: "Disconnecting a Provider requires --yes",
  },
  {
    name: "instruction update conflicting options",
    args: ["instruction", "update", "ID", "--name", "X", "--clear-name"],
    exit: 3,
    message: "--name and --clear-name cannot be used together.",
  },
  ...["connect", "reconnect", "disconnect"].map((action) => ({
    name: `provider ${action} missing ID`,
    args: ["provider", action],
    exit: 2,
    message: `provider ${action} requires <provider-id>`,
  })),
];

test.each(guardedActions)(
  "invalid configuration takes precedence over $name",
  async ({ args, message }) => {
    await using cli = await isolatedCli();
    await fs.mkdir(cli.directory, { recursive: true });
    const source = path.join(cli.directory, "config.toml");
    const content = '[logging]\nlevel = "PRIVATE_BAD_LEVEL"\n';
    await fs.writeFile(source, content);
    const result = await cli.run(args);
    expect(result.exit).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("config.toml (logging.level): Expected");
    expect(result.stderr).not.toContain(message);
    expect(result.stderr).not.toContain("PRIVATE_BAD_LEVEL");
    expect(await fs.readFile(source, "utf8")).toBe(content);
    expect(await fs.readdir(cli.home)).toEqual(["config"]);
  }
);

test("normal CLI startup creates only shared and CLI configuration; usage creates nothing", async () => {
  await using cli = await isolatedCli();
  for (const args of [["--help"], ["--version"], ["entry", "create"]]) {
    await cli.run(args);
    expect(await fs.readdir(cli.home)).toEqual([]);
  }
  const result = await cli.run(["models", "--json"]);
  expect(result.exit).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ ok: true, data: [] });
  expect((await fs.readdir(cli.directory)).sort()).toEqual([
    "cli.toml",
    "config.toml",
  ]);
});

test.each(guardedActions)(
  "normal startup initializes configuration before $name without opening storage",
  async ({ args, exit, message }) => {
    await using cli = await isolatedCli();
    const result = await cli.run(args);
    expect(result.exit).toBe(exit);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(message);
    expect((await fs.readdir(cli.directory)).sort()).toEqual([
      "cli.toml",
      "config.toml",
    ]);
    expect(await fs.readdir(cli.home)).toEqual(["config"]);
  }
);

test.each(guardedActions)(
  "an invalid inherited snapshot blocks $name without disk fallback",
  async ({ args, message }) => {
    await using cli = await isolatedCli();
    const result = await cli.run(args, "", {
      DICTOS_OVERLAY_CONFIG_SNAPSHOT: "",
    });
    expect(result.exit).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("DICTOS_OVERLAY_CONFIG_SNAPSHOT");
    expect(result.stderr).toContain("valid JSON");
    expect(result.stderr).not.toContain(message);
    expect(await fs.readdir(cli.home)).toEqual([]);
  }
);

test("guarded command help and parser failures remain exempt from configuration startup", async () => {
  await using cli = await isolatedCli();
  for (const args of [
    ["provider", "disconnect", "--help"],
    ["instruction", "update", "--help"],
    ["instruction", "update"],
    ["provider", "disconnect", "--unknown-option"],
  ]) {
    const result = await cli.run(args, "", {
      DICTOS_OVERLAY_CONFIG_SNAPSHOT: "",
    });
    expect(result.stderr).not.toContain("DICTOS_OVERLAY_CONFIG_SNAPSHOT");
    expect(await fs.readdir(cli.home)).toEqual([]);
  }
});

test.each(["suggest", "generate", "save"])(
  "malformed Overlay %s requests retain exit 2 before configuration startup",
  async (operation) => {
    await using cli = await isolatedCli();
    const result = await cli.run(["overlay", operation, "--json"], "{}\n", {
      DICTOS_OVERLAY_CONFIG_SNAPSHOT: "",
    });
    expect(result.exit).toBe(2);
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Invalid JSON request" },
    });
    expect(await fs.readdir(cli.home)).toEqual([]);
  }
);

test("legacy Model selection is ignored, device identity is preserved, and Model commands are unavailable", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.dataDirectory, { recursive: true });
  const legacy =
    '{"deviceId":"configuration-test-device","selectedModel":{"providerId":"openai","modelId":"gpt-4o"}}';
  const stateFile = path.join(cli.dataDirectory, "local-state.json");
  await fs.writeFile(stateFile, legacy);
  const missing = await cli.run([
    "description",
    "generate",
    "source",
    "--instruction",
    "instruction",
    "--types",
    "definition",
  ]);
  expect(missing.exit).toBe(3);
  expect(missing.stderr).toContain("generation.default_model");
  expect(missing.stderr).toContain("--model");
  expect(
    await new FsLocalStateRepository(cli.dataDirectory).getLocalState()
  ).toEqual({ deviceId: "configuration-test-device" });
  expect(await fs.readFile(stateFile, "utf8")).toBe(legacy);
  for (const command of ["current", "select"]) {
    const removed = await cli.run([
      "model",
      command,
      ...(command === "select" ? ["openai/gpt-4o"] : []),
    ]);
    expect(removed.exit).not.toBe(0);
    expect(removed.stderr).toContain("unknown command 'model'");
  }
});

test("configuration failures retain actionable safe JSON through every independent command path", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.directory, { recursive: true });
  await fs.writeFile(
    path.join(cli.directory, "config.toml"),
    '[logging]\nlevel = "SECRET_BAD_LEVEL"\n'
  );
  const cases = [
    { args: ["models", "--json"] },
    { args: ["instruction", "list", "--json"] },
    { args: ["overlay", "state", "read", "--json"] },
    {
      args: ["overlay", "state", "write", "--json"],
      input: { version: 1, instructionText: "", selectedTypes: ["definition"] },
    },
    {
      args: ["overlay", "save", "--json"],
      input: { kind: "entry", entryText: "hello", descriptionText: null },
    },
    {
      args: ["overlay", "suggest", "--json"],
      input: {
        model: "openai/model",
        entryText: "hello",
        descriptionText: null,
        instructionText: "",
      },
    },
    {
      args: ["overlay", "generate", "--json"],
      input: {
        model: "openai/model",
        entryText: "hello",
        descriptionText: null,
        instructionText: "",
        senseName: null,
        descriptions: [],
        targetTypes: ["definition"],
      },
    },
    { args: ["overlay", "bootstrap", "--json"] },
  ];
  for (const item of cases) {
    const result = await cli.run(
      item.args,
      item.input ? JSON.stringify(item.input) + "\n" : ""
    );
    expect(result.exit).toBe(5);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const response = JSON.parse(result.stdout);
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe("CONFIGURATION_ERROR");
    expect(response.error.issues.length).toBeGreaterThan(0);
    expect(response.error.message).toContain("config.toml");
    expect(response.error.message).toContain("logging.level");
    expect(response.error.message).toContain("Expected");
    expect(result.stdout + result.stderr).not.toContain("SECRET_BAD_LEVEL");
  }
  expect(await fs.readdir(cli.home)).toEqual(["config"]);
});

test("human dependency errors use the same safe configuration summary before any data access", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.directory, { recursive: true });
  const source = path.join(cli.directory, "config.toml");
  const content = '[logging]\nlevel = "SECRET_BAD_LEVEL"\n';
  await fs.writeFile(source, content);
  for (const args of [
    ["provider", "available"],
    ["entry", "list"],
    ["models"],
    ["instruction", "list"],
  ]) {
    const result = await cli.run(args);
    expect(result.exit).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("config.toml (logging.level): Expected");
    expect(result.stderr).not.toContain("SECRET_BAD_LEVEL");
  }
  expect(await fs.readFile(source, "utf8")).toBe(content);
  expect(await fs.readdir(cli.home)).toEqual(["config"]);
});

test("the real CLI log uses global levels and CLI overrides without changing configuration", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.directory, { recursive: true });
  const globalFile = path.join(cli.directory, "config.toml");
  const cliFile = path.join(cli.directory, "cli.toml");
  const logFile = path.join(cli.dataDirectory, "dictos-cli.log");
  for (const scenario of [
    { global: "", cli: "", debug: false },
    { global: '[logging]\nlevel = "debug"\n', cli: "", debug: true },
    {
      global: '[logging]\nlevel = "trace"\n',
      cli: '[overrides.logging]\nlevel = "fatal"\n',
      debug: false,
    },
    {
      global: '[logging]\nlevel = "fatal"\n',
      cli: '[overrides.logging]\nlevel = "debug"\n',
      debug: true,
    },
  ]) {
    await fs.writeFile(globalFile, scenario.global);
    await fs.writeFile(cliFile, scenario.cli);
    await fs.rm(logFile, { force: true });
    expect((await cli.run(["models", "--json"])).exit).toBe(0);
    const log = await fs.readFile(logFile, "utf8");
    const events =
      log.trim() === ""
        ? []
        : log
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
    expect(
      events.some(
        (event) =>
          event.msg === "CLI operation completed" &&
          event.operation === "models.list" &&
          event.level === 20
      )
    ).toBe(scenario.debug);
    expect(await fs.readFile(globalFile, "utf8")).toBe(scenario.global);
    expect(await fs.readFile(cliFile, "utf8")).toBe(scenario.cli);
  }
});

test("configuration summaries include additional issues and TOML locations without parser input", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.directory, { recursive: true });
  const source = path.join(cli.directory, "config.toml");
  await fs.writeFile(
    source,
    '[generation]\ndefault_model = "private-invalid-model"\n[logging]\nlevel = "private-invalid-level"\n'
  );
  const multiple = await cli.run(["models", "--json"]);
  expect(multiple.exit).toBe(5);
  const response = JSON.parse(multiple.stdout);
  expect(response.error.issues).toHaveLength(2);
  expect(response.error.message).toContain("generation.default_model");
  expect(response.error.message).toContain("1 more issue");
  expect(multiple.stdout + multiple.stderr).not.toContain("private-invalid");
  const malformed = '[generation]\ndefault_model = "private-unclosed\n';
  await fs.writeFile(source, malformed);
  const parsed = await cli.run(["models", "--json"]);
  expect(parsed.exit).toBe(5);
  expect(JSON.parse(parsed.stdout).error.message).toMatch(
    /config\.toml:\d+:\d+/
  );
  expect(parsed.stdout + parsed.stderr).not.toContain("private-unclosed");
  expect(await fs.readFile(source, "utf8")).toBe(malformed);
});

test("an initialization failure stops startup with the target path and exit 5", async () => {
  await using cli = await isolatedCli();
  await fs.writeFile(path.dirname(cli.directory), "blocks parent directory");
  const result = await cli.run(["models", "--json"]);
  expect(result.exit).toBe(5);
  const response = JSON.parse(result.stdout);
  expect(response.error.code).toBe("CONFIGURATION_ERROR");
  expect(response.error.message).toContain("config.toml");
  expect(response.error.issues[0].kind).toBe("initialize");
  expect(await fs.readdir(cli.home)).toEqual(["config"]);
});
