import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { resolveNativeConfigurationPaths } from "./index";

test("discovery uses explicit platform conventions without creating directories", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-paths-"));
  await using cleanup = {
    [Symbol.asyncDispose]: () => fs.rm(root, { recursive: true, force: true }),
  };
  const cases = [
    {
      platform: "linux",
      homeDirectory: root,
      environment: { XDG_CONFIG_HOME: "/settings" },
      expected: "/settings/dictos",
    },
    {
      platform: "linux",
      homeDirectory: root,
      environment: { XDG_CONFIG_HOME: "relative" },
      expected: `${root}/.config/dictos`,
    },
    {
      platform: "freebsd",
      homeDirectory: root,
      environment: {},
      expected: `${root}/.config/dictos`,
    },
    {
      platform: "darwin",
      homeDirectory: root,
      environment: { XDG_CONFIG_HOME: "/ignored" },
      expected: `${root}/Library/Preferences/dictos`,
    },
    {
      platform: "win32",
      homeDirectory: "C:\\Users\\Ada",
      environment: { APPDATA: "D:\\Roaming" },
      expected: "D:\\Roaming\\dictos\\config",
    },
    {
      platform: "win32",
      homeDirectory: "C:\\Users\\Ada",
      environment: { APPDATA: "relative" },
      expected: "C:\\Users\\Ada\\AppData\\Roaming\\dictos\\config",
    },
    {
      platform: "win32",
      homeDirectory: "C:\\Users\\Ada",
      environment: { APPDATA: "\\\\server\\users\\Ada" },
      expected: "\\\\server\\users\\Ada\\dictos\\config",
    },
  ];
  for (const { expected, ...input } of cases) {
    const result = resolveNativeConfigurationPaths(input);
    if (result instanceof Error) throw result;
    expect(result.directory).toBe(expected);
    for (const uri of Object.values(result.schemaUris)) {
      expect(uri.startsWith("file:")).toBe(true);
      expect((await fs.stat(url.fileURLToPath(uri))).isFile()).toBe(true);
    }
  }
  expect(await fs.readdir(root)).toEqual([]);
});

test("exported local schemas match their definitions through the supported drift check", async () => {
  const check = Bun.spawn({
    cmd: [process.execPath, "run", "check:schemas"],
    cwd: url.fileURLToPath(new URL("../../../config/", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10000,
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(check.stdout).text(),
    new Response(check.stderr).text(),
    check.exited,
  ]);
  expect({ stdout, stderr, status }).toMatchObject({ status: 0 });
});
