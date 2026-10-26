import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import * as toml from "smol-toml";
import type { ConfigurationClient } from "@dictos/config";
import {
  resolveNativeConfigurationPaths,
  type NativeConfigurationPaths,
} from "./index";

async function fixture() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-creation-race-")
  );
  const paths = resolveNativeConfigurationPaths({
    platform: "linux",
    homeDirectory: root,
    environment: {},
  });
  if (paths instanceof Error) {
    await fs.rm(root, { recursive: true, force: true });
    throw paths;
  }
  return {
    root,
    paths,
    [Symbol.asyncDispose]: () => fs.rm(root, { recursive: true, force: true }),
  };
}

async function startTogether(input: {
  paths: NativeConfigurationPaths;
  client: ConfigurationClient;
}) {
  const code = `
    import { initializeAndLoadConfiguration } from ${JSON.stringify(import.meta.resolve("@dictos/fs-storage/configuration"))};
    console.log("ready");
    await Bun.stdin.text();
    const result = await initializeAndLoadConfiguration(JSON.parse(process.argv[1]));
    console.log(JSON.stringify(result instanceof Error ? { issues: result.issues } : result));
    process.exitCode = result instanceof Error ? 5 : 0;
  `;
  const children = Array.from({ length: 10 }, () =>
    Bun.spawn({
      cmd: [
        process.execPath,
        "--eval",
        code,
        JSON.stringify({ ...input, ocrLanguageEnvironment: null }),
      ],
      cwd: os.tmpdir(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10000,
    })
  );
  const readers = await Promise.all(
    children.map(async (child) => {
      const reader = child.stdout.getReader();
      const decoder = new TextDecoder();
      let readiness = "";
      while (!readiness.endsWith("\n")) {
        const chunk = await reader.read();
        if (chunk.done) break;
        readiness += decoder.decode(chunk.value, { stream: true });
      }
      expect(readiness).toBe("ready\n");
      return reader;
    })
  );
  const outcomes = children.map(async (child, index) => {
    const remainingOutput = (async () => {
      const reader = readers[index]!;
      const decoder = new TextDecoder();
      let output = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        output += decoder.decode(chunk.value, { stream: true });
      }
      reader.releaseLock();
      return output + decoder.decode();
    })();
    const [stdout, stderr, status] = await Promise.all([
      remainingOutput,
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, status };
  });
  for (const child of children) {
    child.stdin.write("start");
    child.stdin.end();
  }
  return Promise.all(outcomes);
}

test("concurrent Bun startups publish only complete Overlay starters without temporary leftovers", async () => {
  await using context = await fixture();
  const outcomes = await startTogether({
    paths: context.paths,
    client: "overlay",
  });
  for (const outcome of outcomes) {
    expect(outcome.stderr).toBe("");
    expect(outcome.status).toBe(0);
    expect(JSON.parse(outcome.stdout).settings).toEqual({
      defaultModel: null,
      logLevel: "info",
      ocrLanguages: ["eng"],
    });
  }
  expect((await fs.readdir(context.paths.directory)).sort()).toEqual([
    "cli.toml",
    "config.toml",
    "overlay.toml",
  ]);
  for (const name of ["config", "cli", "overlay"]) {
    const target = path.join(context.paths.directory, `${name}.toml`);
    const content = await fs.readFile(target, "utf8");
    expect(content.endsWith("\n")).toBe(true);
    expect(toml.parse(content)).toEqual({});
    expect(
      content.split("\n").every((line) => line === "" || line.startsWith("#"))
    ).toBe(true);
    expect(
      (
        await fs.stat(
          url.fileURLToPath(content.split("\n")[0]!.slice("#:schema ".length))
        )
      ).isFile()
    ).toBe(true);
  }
}, 15000);

test("concurrent startups preserve custom and empty files and existing symlinks, including malformed targets", async () => {
  await using context = await fixture();
  await fs.mkdir(context.paths.directory, { recursive: true });
  const global = path.join(context.paths.directory, "config.toml");
  const cli = path.join(context.paths.directory, "cli.toml");
  const overlay = path.join(context.paths.directory, "overlay.toml");
  const custom =
    '#:schema file:///custom/schema.json\n# keep this comment\n[logging]\nlevel = "error"\n';
  await fs.writeFile(global, custom);
  await fs.writeFile(cli, "");
  const external = path.join(context.root, "user-overlay.toml");
  await fs.writeFile(external, '[ocr]\nlanguages = ["pol"]\n');
  await fs.symlink(external, overlay);
  const before = await Promise.all(
    [global, cli, overlay, external].map((target) => fs.lstat(target))
  );
  for (const content of [
    '[ocr]\nlanguages = ["pol"]\n',
    "[ocr\nPRIVATE_INPUT",
  ]) {
    await fs.writeFile(external, content);
    const outcomes = await startTogether({
      paths: context.paths,
      client: "overlay",
    });
    for (const outcome of outcomes) {
      expect(outcome.stderr).toBe("");
      expect(outcome.status).toBe(content.includes("PRIVATE_INPUT") ? 5 : 0);
      if (outcome.status === 5)
        expect(JSON.parse(outcome.stdout).issues[0]).toMatchObject({
          kind: "parse",
          source: overlay,
        });
    }
    expect(await fs.readFile(global, "utf8")).toBe(custom);
    expect(await fs.readFile(cli, "utf8")).toBe("");
    expect(await fs.readlink(overlay)).toBe(external);
    expect(await fs.readFile(external, "utf8")).toBe(content);
    const after = await Promise.all(
      [global, cli, overlay, external].map((target) => fs.lstat(target))
    );
    expect(after.map((stat) => stat.ino)).toEqual(
      before.map((stat) => stat.ino)
    );
    expect(after.slice(0, 3).map((stat) => stat.mtimeMs)).toEqual(
      before.slice(0, 3).map((stat) => stat.mtimeMs)
    );
    expect((await fs.readdir(context.paths.directory)).sort()).toEqual([
      "cli.toml",
      "config.toml",
      "overlay.toml",
    ]);
  }
}, 15000);
