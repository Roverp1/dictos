import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveConfiguration,
  validateConfigurationSnapshot,
} from "@dictos/config";
import { decodeBootstrapResponse } from "./prepare-launch";

test("bootstrap decoder returns only compact validated Overlay snapshot JSON", () => {
  const snapshot = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (snapshot instanceof Error) throw snapshot;
  const result = decodeBootstrapResponse({
    stdout: JSON.stringify({ ok: true, data: snapshot }) + "\n",
    exitCode: 0,
  });
  expect(result).toBe(JSON.stringify(snapshot));
});

test("configuration exit 5 preserves the actionable summary without stderr", () => {
  const message =
    "/tmp/config/cli.toml: overrides.logging.level: expected a supported logging level";
  const result = decodeBootstrapResponse({
    exitCode: 5,
    stdout:
      JSON.stringify({
        ok: false,
        error: {
          code: "CONFIGURATION_ERROR",
          message,
          issues: [
            {
              kind: "validate",
              source: "/tmp/config/cli.toml",
              keyPath: ["overrides", "logging", "level"],
              line: null,
              column: null,
              message: "expected a supported logging level",
            },
          ],
        },
      }) + "\n",
  });
  expect(result).toBeInstanceOf(Error);
  if (!(result instanceof Error)) return;
  expect(result.message).toBe(message);
});

test("bootstrap refuses oversized output and encoded snapshots", () => {
  const snapshot = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (snapshot instanceof Error) throw snapshot;
  expect(
    decodeBootstrapResponse({
      exitCode: 0,
      stdout:
        " ".repeat(1024 * 1024) +
        JSON.stringify({ ok: true, data: snapshot }) +
        "\n",
    })
  ).toBeInstanceOf(Error);
  const oversized = resolveConfiguration({
    client: "overlay",
    documents: {
      global: {
        source: "config.toml",
        value: {
          generation: { default_model: "openai/" + "a".repeat(16 * 1024) },
        },
      },
    },
    environment: { ocrLanguages: null },
  });
  if (oversized instanceof Error) throw oversized;
  expect(
    validateConfigurationSnapshot({ value: oversized })
  ).not.toBeInstanceOf(Error);
  expect(
    decodeBootstrapResponse({
      exitCode: 0,
      stdout: JSON.stringify({ ok: true, data: oversized }) + "\n",
    })
  ).toBeInstanceOf(Error);
});

test("bootstrap rejects malformed framing, contradictory envelopes, wrong clients, and nonzero success", () => {
  const snapshot = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (snapshot instanceof Error) throw snapshot;
  const cliSnapshot = resolveConfiguration({
    client: "cli",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (cliSnapshot instanceof Error) throw cliSnapshot;
  const success = { ok: true, data: snapshot };
  for (const input of [
    { exitCode: 0, stdout: JSON.stringify(success) },
    { exitCode: 0, stdout: JSON.stringify(success) + "\n{}\n" },
    { exitCode: 1, stdout: JSON.stringify(success) + "\n" },
    {
      exitCode: 0,
      stdout:
        JSON.stringify({ ...success, error: { message: "secret" } }) + "\n",
    },
    {
      exitCode: 0,
      stdout: JSON.stringify({ ok: true, data: cliSnapshot }) + "\n",
    },
    {
      exitCode: 5,
      stdout:
        JSON.stringify({
          ok: false,
          error: { code: "CONFIGURATION_ERROR", message: "secret", issues: [] },
        }) + "\n",
    },
    { exitCode: 1, stdout: "secret garbage\n" },
  ]) {
    const result = decodeBootstrapResponse(input);
    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) expect(result.message).not.toContain("secret");
  }
});

test("real launch preparation bootstraps all files and emits English-default snapshot only", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-prepare-"));
  await using cleanup = {
    [Symbol.asyncDispose]: () => fs.rm(home, { recursive: true, force: true }),
  };
  const child = Bun.spawn(
    [process.execPath, path.join(import.meta.dir, "prepare-launch.ts")],
    {
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: path.join(home, "config"),
        XDG_DATA_HOME: path.join(home, "data"),
        DICTOS_OCR_LANG: "",
        DICTOS_OVERLAY_CONFIG_SNAPSHOT: "invalid parent snapshot",
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode).toBe(0);
  expect(stderr).toBe("");
  const snapshot = JSON.parse(stdout);
  expect(snapshot.client).toBe("overlay");
  expect(snapshot.settings).toEqual({
    defaultModel: null,
    logLevel: "info",
    ocrLanguages: ["eng"],
  });
  expect(stdout).toBe(JSON.stringify(snapshot) + "\n");
  expect((await fs.readdir(path.join(home, "config/dictos"))).sort()).toEqual([
    "cli.toml",
    "config.toml",
    "overlay.toml",
  ]);
  expect(await fs.exists(path.join(home, "data"))).toBe(false);
});

test("real launch preparation preserves configured languages and reports configuration failures on stderr only", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-prepare-"));
  await using cleanup = {
    [Symbol.asyncDispose]: () => fs.rm(home, { recursive: true, force: true }),
  };
  const directory = path.join(home, "config/dictos");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "overlay.toml"),
    '[ocr]\nlanguages = ["pol", "eng"]\n'
  );
  const run = async () => {
    const child = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "prepare-launch.ts")],
      {
        env: {
          ...process.env,
          HOME: home,
          XDG_CONFIG_HOME: path.join(home, "config"),
          XDG_DATA_HOME: path.join(home, "data"),
          DICTOS_OCR_LANG: "",
          DICTOS_OVERLAY_CONFIG_SNAPSHOT: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  };
  const success = await run();
  expect(success.exitCode).toBe(0);
  expect(success.stderr).toBe("");
  expect(JSON.parse(success.stdout).settings.ocrLanguages.join("+")).toBe(
    "pol+eng"
  );
  const invalid = '[overrides.logging]\nlevel = "not-a-level"\n';
  await fs.writeFile(path.join(directory, "cli.toml"), invalid);
  const failure = await run();
  expect(failure.exitCode).not.toBe(0);
  expect(failure.stdout).toBe("");
  expect(failure.stderr).toContain(path.join(directory, "cli.toml"));
  expect(failure.stderr).toContain("overrides.logging.level");
  expect(failure.stderr).toContain(
    "Expected trace, debug, info, warn, error, or fatal"
  );
  expect(failure.stderr).not.toContain("not-a-level");
  expect(await fs.readFile(path.join(directory, "cli.toml"), "utf8")).toBe(
    invalid
  );
});
