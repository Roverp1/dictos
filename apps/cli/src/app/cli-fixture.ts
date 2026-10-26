import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function isolatedEnvironment(home: string) {
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, "config"),
    XDG_DATA_HOME: home,
    APPDATA: path.join(home, "appdata"),
    // Keep Bun's cache from obscuring application writes in the isolated home.
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
    DICTOS_OVERLAY_CONFIG_SNAPSHOT: undefined,
    DICTOS_OCR_LANG: undefined,
  };
}

export function isolateProcessEnvironment(home: string) {
  const environment = isolatedEnvironment(home);
  const keys = [
    "HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "APPDATA",
    "BUN_RUNTIME_TRANSPILER_CACHE_PATH",
    "DICTOS_OVERLAY_CONFIG_SNAPSHOT",
    "DICTOS_OCR_LANG",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );
  for (const key of keys) {
    if (environment[key] === undefined) delete process.env[key];
    else process.env[key] = environment[key];
  }
  return () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  };
}

export async function isolatedCli() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-config-cli-"));
  const env = isolatedEnvironment(home);
  return {
    home,
    directory: path.join(env.XDG_CONFIG_HOME, "dictos"),
    dataDirectory: path.join(env.XDG_DATA_HOME, "dictos"),
    async run(
      args: string[],
      input = "",
      environment: Record<string, string> = {},
      preload: string | null = null
    ) {
      const child = Bun.spawn(
        [
          process.execPath,
          ...(preload === null ? [] : ["--preload", preload]),
          path.resolve(import.meta.dir, "../index.ts"),
          ...args,
        ],
        {
          env: { ...env, ...environment },
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      child.stdin.write(input);
      child.stdin.end();
      const [stdout, stderr, exit] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      return { stdout, stderr, exit };
    },
    async [Symbol.asyncDispose]() {
      await fs.rm(home, { recursive: true, force: true });
    },
  };
}
