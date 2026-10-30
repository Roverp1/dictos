import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import * as toml from "smol-toml";
import { describeConfiguration } from "@dictos/config";
import {
  initializeAndLoadConfiguration,
  resolveNativeConfigurationPaths,
} from "./index";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-config-"));
  const paths = resolveNativeConfigurationPaths({
    platform: "linux",
    homeDirectory: root,
    environment: {},
  });
  if (paths instanceof Error) {
    await fs.rm(root, { recursive: true, force: true });
    throw paths;
  }
  await fs.mkdir(paths.directory, { recursive: true });
  return {
    root,
    paths,
    [Symbol.asyncDispose]: () => fs.rm(root, { recursive: true, force: true }),
  };
}

test("first CLI startup publishes documented commented starters with usable release schemas", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-config-"));
  await using cleanup = {
    [Symbol.asyncDispose]: () => fs.rm(root, { recursive: true, force: true }),
  };
  const paths = resolveNativeConfigurationPaths({
    platform: "linux",
    homeDirectory: root,
    environment: {},
  });
  if (paths instanceof Error) throw paths;
  const result = await initializeAndLoadConfiguration({
    client: "cli",
    paths,
    ocrLanguageEnvironment: "pol",
  });
  if (result instanceof Error) throw result;
  expect(result.settings).toEqual({
    defaultModel: null,
    logLevel: "info",
    ocrLanguages: null,
  });
  expect((await fs.readdir(paths.directory)).sort()).toEqual([
    "cli.toml",
    "config.toml",
  ]);
  for (const [scope, name] of [
    ["global", "config"],
    ["cli", "cli"],
  ] as const) {
    const target = path.join(paths.directory, `${name}.toml`);
    const text = await fs.readFile(target, "utf8");
    expect(toml.parse(text)).toEqual({});
    expect(
      text.split("\n").every((line) => line === "" || line.startsWith("#"))
    ).toBe(true);
    for (const setting of describeConfiguration({ scope }))
      expect(text).toContain(setting.description);
    const directive = text.split("\n")[0]!.slice("#:schema ".length);
    expect((await fs.stat(url.fileURLToPath(directive))).isFile()).toBe(true);
    expect(
      JSON.parse(await fs.readFile(url.fileURLToPath(directive), "utf8"))
    ).toHaveProperty("properties");
    if (process.platform !== "win32")
      expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  }
});

test("file reads reject oversized and non-UTF-8 input and report safe TOML locations", async () => {
  await using context = await fixture();
  const target = path.join(context.paths.directory, "config.toml");
  for (const [content, kind, message] of [
    [Buffer.alloc(256 * 1024 + 1, 32), "read", "256 KiB"],
    [Buffer.from([0xff, 0xfe]), "read", "UTF-8"],
    [Buffer.from('[logging]\nlevel = "PRIVATE_INPUT\n'), "parse", "TOML"],
  ] as const) {
    await fs.writeFile(target, content);
    const result = await initializeAndLoadConfiguration({
      client: "cli",
      paths: context.paths,
      ocrLanguageEnvironment: null,
    });
    expect(result).toBeInstanceOf(Error);
    if (!(result instanceof Error))
      throw new Error("Expected a configuration failure");
    expect(result.issues[0]).toMatchObject({ kind, source: target });
    expect(result.issues[0]!.message).toContain(message);
    expect(JSON.stringify(result.issues)).not.toContain("PRIVATE_INPUT");
    if (kind === "parse") {
      expect(result.issues[0]!.line).toBe(2);
      expect(result.issues[0]!.column).toBeGreaterThan(0);
      expect(result.cause).toBeInstanceOf(Error);
    }
    expect(await fs.readFile(target)).toEqual(content);
  }
  await fs.writeFile(target, `#${" ".repeat(256 * 1024 - 1)}`);
  const atLimit = await initializeAndLoadConfiguration({
    client: "cli",
    paths: context.paths,
    ocrLanguageEnvironment: null,
  });
  if (atLimit instanceof Error) throw atLimit;
  expect(atLimit.settings.logLevel).toBe("info");
});

test("Overlay replaces configured OCR languages with the ordered environment override", async () => {
  await using context = await fixture();
  const target = path.join(context.paths.directory, "overlay.toml");
  const content = '[ocr]\nlanguages = ["pol"]\n';
  await fs.writeFile(target, content);
  const result = await initializeAndLoadConfiguration({
    client: "overlay",
    paths: context.paths,
    ocrLanguageEnvironment: "eng+script/Latin",
  });
  if (result instanceof Error) throw result;
  expect(result.settings.ocrLanguages).toEqual(["eng", "script/Latin"]);
  expect(result.origins.ocrLanguages).toMatchObject({
    kind: "environment",
    source: "DICTOS_OCR_LANG",
  });
  for (const empty of [null, ""]) {
    const inherited = await initializeAndLoadConfiguration({
      client: "overlay",
      paths: context.paths,
      ocrLanguageEnvironment: empty,
    });
    if (inherited instanceof Error) throw inherited;
    expect(inherited.settings.ocrLanguages).toEqual(["pol"]);
  }
  const invalid = await initializeAndLoadConfiguration({
    client: "overlay",
    paths: context.paths,
    ocrLanguageEnvironment: "eng++pol",
  });
  expect(invalid).toBeInstanceOf(Error);
  if (!(invalid instanceof Error))
    throw new Error("Expected invalid languages to fail");
  expect(invalid.issues[0]).toMatchObject({
    kind: "validate",
    source: "DICTOS_OCR_LANG",
  });
  expect(await fs.readFile(target, "utf8")).toBe(content);
});

test("only the client's chain participates and invalid lower-priority contributions cannot be hidden", async () => {
  await using context = await fixture();
  await fs.writeFile(
    path.join(context.paths.directory, "config.toml"),
    '[generation]\ndefault_model = "openai/global"\n[logging]\nlevel = "warn"\n'
  );
  await fs.writeFile(
    path.join(context.paths.directory, "cli.toml"),
    '[overrides.generation]\ndefault_model = "openai/cli"\n[overrides.logging]\nlevel = "debug"\n'
  );
  await fs.writeFile(
    path.join(context.paths.directory, "overlay.toml"),
    '[overrides.logging]\nlevel = "trace"\n'
  );
  const cli = await initializeAndLoadConfiguration({
    client: "cli",
    paths: context.paths,
    ocrLanguageEnvironment: "eng++pol",
  });
  if (cli instanceof Error) throw cli;
  expect(cli.settings).toEqual({
    defaultModel: "openai/cli",
    logLevel: "debug",
    ocrLanguages: null,
  });
  expect(cli.origins.defaultModel).toMatchObject({
    kind: "cli",
    source: path.join(context.paths.directory, "cli.toml"),
    keyPath: ["overrides", "generation", "default_model"],
  });
  const overlay = await initializeAndLoadConfiguration({
    client: "overlay",
    paths: context.paths,
    ocrLanguageEnvironment: null,
  });
  expect(overlay).toBeInstanceOf(Error);
  if (!(overlay instanceof Error))
    throw new Error("Expected prohibited Overlay logging override to fail");
  expect(overlay.issues[0]!.source).toBe(
    path.join(context.paths.directory, "overlay.toml")
  );
  await fs.writeFile(
    path.join(context.paths.directory, "overlay.toml"),
    '[overrides.generation]\ndefault_model = "google/overlay"\n'
  );
  await fs.writeFile(
    path.join(context.paths.directory, "cli.toml"),
    '[overrides.generation]\ndefault_model = ""\n'
  );
  for (const client of ["cli", "overlay"] as const) {
    const result = await initializeAndLoadConfiguration({
      client,
      paths: context.paths,
      ocrLanguageEnvironment: null,
    });
    expect(result).toBeInstanceOf(Error);
    if (!(result instanceof Error))
      throw new Error("Expected invalid CLI contribution to fail");
    expect(result.issues[0]).toMatchObject({
      kind: "validate",
      source: path.join(context.paths.directory, "cli.toml"),
      keyPath: ["overrides", "generation", "default_model"],
    });
  }
});

test("all required schema artifacts are checked before creating any configuration files", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-schema-failure-")
  );
  await using cleanup = {
    [Symbol.asyncDispose]: () => fs.rm(root, { recursive: true, force: true }),
  };
  const paths = resolveNativeConfigurationPaths({
    platform: "linux",
    homeDirectory: root,
    environment: {},
  });
  if (paths instanceof Error) throw paths;
  for (const schemaUri of [
    url.pathToFileURL(path.join(root, "missing.schema.json")).href,
    "https://example.invalid/schema.json",
    url.pathToFileURL(root).href,
  ]) {
    const result = await initializeAndLoadConfiguration({
      client: "overlay",
      paths: {
        ...paths,
        schemaUris: { ...paths.schemaUris, overlay: schemaUri },
      },
      ocrLanguageEnvironment: null,
    });
    expect(result).toBeInstanceOf(Error);
    if (!(result instanceof Error))
      throw new Error("Expected unusable schema to fail");
    expect(result.issues[0]).toMatchObject({
      kind: "initialize",
      source: schemaUri,
    });
    expect(await fs.readdir(root)).toEqual([]);
  }
});

test("initialization and read failures identify the target and preserve directories and dangling symlinks", async () => {
  await using context = await fixture();
  const target = path.join(context.paths.directory, "config.toml");
  await fs.mkdir(target);
  const directory = await initializeAndLoadConfiguration({
    client: "cli",
    paths: context.paths,
    ocrLanguageEnvironment: null,
  });
  expect(directory).toBeInstanceOf(Error);
  if (!(directory instanceof Error))
    throw new Error("Expected directory input to fail");
  expect(directory.issues[0]).toMatchObject({ kind: "read", source: target });
  expect((await fs.stat(target)).isDirectory()).toBe(true);
  await fs.rmdir(target);
  const absent = path.join(context.root, "absent-user-config.toml");
  await fs.symlink(absent, target);
  const dangling = await initializeAndLoadConfiguration({
    client: "cli",
    paths: context.paths,
    ocrLanguageEnvironment: null,
  });
  expect(dangling).toBeInstanceOf(Error);
  if (!(dangling instanceof Error))
    throw new Error("Expected dangling symlink input to fail");
  expect(dangling.issues[0]).toMatchObject({ kind: "read", source: target });
  expect(dangling.cause).toBeInstanceOf(Error);
  expect(await fs.readlink(target)).toBe(absent);
  expect(await fs.readdir(context.paths.directory)).toEqual(["config.toml"]);
  const blocked = path.join(context.root, "not-a-directory");
  await fs.writeFile(blocked, "preserve me");
  const initialization = await initializeAndLoadConfiguration({
    client: "cli",
    paths: { ...context.paths, directory: path.join(blocked, "nested") },
    ocrLanguageEnvironment: null,
  });
  expect(initialization).toBeInstanceOf(Error);
  if (!(initialization instanceof Error))
    throw new Error("Expected blocked parent to fail");
  expect(initialization.issues[0]).toMatchObject({
    kind: "initialize",
    source: path.join(blocked, "nested", "config.toml"),
  });
  expect(await fs.readFile(blocked, "utf8")).toBe("preserve me");
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "permission failures return configuration issues with I/O causes and leave no temporary files",
  async () => {
    await using context = await fixture();
    await using permissions = {
      [Symbol.asyncDispose]: () => fs.chmod(context.paths.directory, 0o700),
    };
    const target = path.join(context.paths.directory, "config.toml");
    await fs.writeFile(target, "# private user file\n", { mode: 0o000 });
    const unreadable = await initializeAndLoadConfiguration({
      client: "cli",
      paths: context.paths,
      ocrLanguageEnvironment: null,
    });
    expect(unreadable).toBeInstanceOf(Error);
    if (!(unreadable instanceof Error))
      throw new Error("Expected unreadable input to fail");
    expect(unreadable.issues[0]).toMatchObject({
      kind: "read",
      source: target,
    });
    expect(unreadable.cause).toMatchObject({ code: "EACCES" });
    await fs.unlink(target);
    await fs.chmod(context.paths.directory, 0o500);
    const unwritable = await initializeAndLoadConfiguration({
      client: "cli",
      paths: context.paths,
      ocrLanguageEnvironment: null,
    });
    expect(unwritable).toBeInstanceOf(Error);
    if (!(unwritable instanceof Error))
      throw new Error("Expected unwritable directory to fail");
    expect(unwritable.issues[0]).toMatchObject({
      kind: "initialize",
      source: target,
    });
    expect(unwritable.cause).toMatchObject({ code: "EACCES" });
    expect(await fs.readdir(context.paths.directory)).toEqual([]);
  }
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "unreadable schema artifacts fail before publishing starters with unusable directives",
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "dictos-unreadable-schema-")
    );
    await using cleanup = {
      [Symbol.asyncDispose]: () =>
        fs.rm(root, { recursive: true, force: true }),
    };
    const paths = resolveNativeConfigurationPaths({
      platform: "linux",
      homeDirectory: root,
      environment: {},
    });
    if (paths instanceof Error) throw paths;
    const artifact = path.join(root, "config.schema.json");
    await fs.copyFile(url.fileURLToPath(paths.schemaUris.global), artifact);
    await fs.chmod(artifact, 0o000);
    const schemaUri = url.pathToFileURL(artifact).href;
    const result = await initializeAndLoadConfiguration({
      client: "cli",
      paths: {
        ...paths,
        schemaUris: { ...paths.schemaUris, global: schemaUri },
      },
      ocrLanguageEnvironment: null,
    });
    expect(result).toBeInstanceOf(Error);
    if (!(result instanceof Error))
      throw new Error("Expected inaccessible schema to fail");
    expect(result.issues[0]).toMatchObject({
      kind: "initialize",
      source: schemaUri,
    });
    expect(result.cause).toMatchObject({ code: "EACCES" });
    expect(await fs.readdir(root)).toEqual(["config.schema.json"]);
  }
);
