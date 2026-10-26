import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "@dictos/errore";

test("schema commands generate deterministically and report drift without writing files", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-config-schema-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.resolve(import.meta.dir, "..");
  for (const name of ["src", "scripts", "schemas", "package.json"])
    await fs.cp(path.join(root, name), path.join(directory, name), {
      recursive: true,
    });
  await fs.symlink(
    path.join(root, "node_modules"),
    path.join(directory, "node_modules"),
    "dir"
  );
  const run = async (script: string) => {
    const child = Bun.spawn([process.execPath, "run", script], {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [, stderr] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { exitCode: await child.exited, stderr };
  };
  expect((await run("check:schemas")).exitCode).toBe(0);
  const file = path.join(directory, "schemas", "config.schema.json");
  const original = await fs.readFile(file, "utf8");
  expect((await run("generate:schemas")).exitCode).toBe(0);
  expect(await fs.readFile(file, "utf8")).toBe(original);
  await fs.writeFile(file, "{}\n");
  const before = await fs.stat(file);
  const drift = await run("check:schemas");
  expect(drift.exitCode).toBe(1);
  expect(drift.stderr).toContain("config.schema.json");
  expect(await fs.readFile(file, "utf8")).toBe("{}\n");
  expect((await fs.stat(file)).mtimeMs).toBe(before.mtimeMs);
  await fs.rm(file);
  expect((await run("check:schemas")).exitCode).toBe(1);
  expect(await fs.exists(file)).toBe(false);
  expect((await run("generate:schemas")).exitCode).toBe(0);
  expect(await fs.readFile(file, "utf8")).toBe(original);
  expect((await run("check:schemas")).exitCode).toBe(0);
});
