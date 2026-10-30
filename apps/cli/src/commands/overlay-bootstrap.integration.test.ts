import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { isolatedCli } from "../app/cli-fixture";
import { resolveConfiguration } from "@dictos/config";

test("bootstrap starts a fresh Overlay chain without data access and ignores inherited snapshots", async () => {
  await using cli = await isolatedCli();
  const first = await cli.run(["overlay", "bootstrap", "--json"], "", {
    DICTOS_OVERLAY_CONFIG_SNAPSHOT: "",
  });
  expect(first.exit).toBe(0);
  expect(first.stdout.trim().split("\n")).toHaveLength(1);
  const snapshot = JSON.parse(first.stdout).data;
  expect(snapshot.client).toBe("overlay");
  expect(snapshot.settings).toEqual({
    defaultModel: null,
    logLevel: "info",
    ocrLanguages: ["eng"],
  });
  expect((await fs.readdir(cli.directory)).sort()).toEqual([
    "cli.toml",
    "config.toml",
    "overlay.toml",
  ]);
  expect(await fs.readdir(cli.home)).toEqual(["config"]);
  await fs.writeFile(
    path.join(cli.directory, "overlay.toml"),
    '[overrides.generation]\ndefault_model = "openai/new-model"\n'
  );
  const second = await cli.run(["overlay", "bootstrap", "--json"], "", {
    DICTOS_OVERLAY_CONFIG_SNAPSHOT: JSON.stringify(snapshot),
  });
  expect(second.exit).toBe(0);
  expect(JSON.parse(second.stdout).data.settings.defaultModel).toBe(
    "openai/new-model"
  );
});

test("children retain the opening's snapshot and logger threshold after invalid file edits", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.directory, { recursive: true });
  await fs.writeFile(
    path.join(cli.directory, "cli.toml"),
    '[overrides.logging]\nlevel = "debug"\n'
  );
  await fs.writeFile(
    path.join(cli.directory, "overlay.toml"),
    '[ocr]\nlanguages = ["eng", "pol"]\n[overrides.generation]\ndefault_model = "openai/opening-model"\n'
  );
  const opening = await cli.run(["overlay", "bootstrap", "--json"]);
  expect(opening.exit).toBe(0);
  const snapshot = JSON.parse(opening.stdout).data;
  expect(snapshot.settings).toEqual({
    defaultModel: "openai/opening-model",
    logLevel: "debug",
    ocrLanguages: ["eng", "pol"],
  });
  await fs.writeFile(
    path.join(cli.directory, "cli.toml"),
    'broken = "private-invalid-value"\n'
  );
  const env = {
    DICTOS_OVERLAY_CONFIG_SNAPSHOT: JSON.stringify(snapshot),
    DICTOS_OCR_LANG: "invalid++languages",
  };
  const listed = await cli.run(["models", "--json"], "", env);
  expect(listed.exit).toBe(0);
  expect(JSON.parse(listed.stdout)).toEqual({ ok: true, data: [] });
  const state = await cli.run(["overlay", "state", "read", "--json"], "", env);
  expect(state.exit).toBe(0);
  expect(JSON.parse(state.stdout).data).toEqual({
    version: 1,
    instructionText: "",
    selectedTypes: ["definition"],
  });
  expect(
    await fs.readFile(path.join(cli.dataDirectory, "dictos-cli.log"), "utf8")
  ).toContain('"operation":"models.list"');
  expect(await fs.readdir(cli.dataDirectory)).not.toContain("dictos.db");
  const fresh = await cli.run(["overlay", "bootstrap", "--json"], "", env);
  expect(fresh.exit).toBe(5);
  expect(JSON.parse(fresh.stdout).error.message).toContain("cli.toml");
});

test("invalid inherited snapshots fail closed without discovering files or opening storage", async () => {
  await using cli = await isolatedCli();
  const cliSnapshot = resolveConfiguration({
    client: "cli",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (cliSnapshot instanceof Error) throw cliSnapshot;
  const overlaySnapshot = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (overlaySnapshot instanceof Error) throw overlaySnapshot;
  for (const encoded of [
    "",
    "private-not-json",
    "{}",
    " ".repeat(16 * 1024 + 1),
    JSON.stringify(cliSnapshot),
    JSON.stringify({ ...overlaySnapshot, version: 2 }),
    JSON.stringify({
      ...overlaySnapshot,
      settings: {
        ...overlaySnapshot.settings,
        logLevel: "private-invalid-level",
      },
    }),
  ]) {
    for (const args of [
      ["models", "--json"],
      ["overlay", "state", "read", "--json"],
    ]) {
      const result = await cli.run(args, "", {
        DICTOS_OVERLAY_CONFIG_SNAPSHOT: encoded,
      });
      expect(result.exit).toBe(5);
      const response = JSON.parse(result.stdout);
      expect(response.error.code).toBe("CONFIGURATION_ERROR");
      expect(response.error.message).toMatch(/snapshot/i);
      expect(response.error.issues.length).toBeGreaterThan(0);
      expect(result.stdout + result.stderr).not.toContain("private-");
    }
    expect(await fs.readdir(cli.home)).toEqual([]);
  }
});

test("a valid snapshot at the encoded limit needs no configuration files; one extra byte fails", async () => {
  await using cli = await isolatedCli();
  const snapshot = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (snapshot instanceof Error) throw snapshot;
  const encoded = JSON.stringify(snapshot).padEnd(16 * 1024, " ");
  const valid = await cli.run(["overlay", "state", "read", "--json"], "", {
    DICTOS_OVERLAY_CONFIG_SNAPSHOT: encoded,
  });
  expect(valid.exit).toBe(0);
  expect(JSON.parse(valid.stdout).ok).toBe(true);
  const oversized = await cli.run(["overlay", "state", "read", "--json"], "", {
    DICTOS_OVERLAY_CONFIG_SNAPSHOT: encoded + " ",
  });
  expect(oversized.exit).toBe(5);
  expect(JSON.parse(oversized.stdout).error.message).toContain("16 KiB");
  expect(await fs.readdir(cli.home)).toEqual(["dictos"]);
});

test("Overlay generation requires its own qualified Model even when a default exists", async () => {
  await using cli = await isolatedCli();
  await fs.mkdir(cli.directory, { recursive: true });
  await fs.writeFile(
    path.join(cli.directory, "config.toml"),
    '[generation]\ndefault_model = "openai/configured"\n'
  );
  for (const model of [
    undefined,
    "",
    "unqualified",
    " openai/model",
    "openai/",
  ]) {
    for (const operation of ["suggest", "generate"]) {
      const result = await cli.run(
        ["overlay", operation, "--json"],
        JSON.stringify({
          entryText: "read",
          descriptionText: null,
          instructionText: "",
          senseName: null,
          descriptions: [],
          targetTypes: ["definition"],
          model,
        }) + "\n"
      );
      expect(result.exit).toBe(2);
      expect(JSON.parse(result.stdout)).toEqual({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Invalid JSON request" },
      });
    }
  }
  expect(await fs.readdir(cli.home)).toEqual(["config"]);
});
