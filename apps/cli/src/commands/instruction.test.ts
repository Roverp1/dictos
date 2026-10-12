import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import { createCliContext } from "../app/context";
import { registerInstructionCommands } from "./instruction";

const originalDataHome = process.env.XDG_DATA_HOME;

afterEach(() => {
  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;
  process.exitCode = 0;
});

test("instruction list --json returns saved multiline text in one JSON envelope", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-cli-instruction-")
  );
  process.env.XDG_DATA_HOME = root;
  const lines: string[] = [];
  const errors: string[] = [];
  const context = createCliContext();
  context.output = {
    writeData: (text) => lines.push(text),
    writeError: (text) => errors.push(text),
  };
  const program = new Command().name("dictos").exitOverride();
  registerInstructionCommands(program, context);
  try {
    const text = "Pierwsza linia\nDruga\tlinia \u001b[31m";
    await program.parseAsync(
      ["instruction", "create", "--name", "Polski", "--text", text],
      { from: "user" }
    );
    const id = lines.pop();
    await program.parseAsync(["instruction", "list", "--json"], {
      from: "user",
    });
    expect(lines).toEqual([
      JSON.stringify({ ok: true, data: [{ id, name: "Polski", text }] }),
    ]);
    expect(errors).toEqual([]);
    expect(process.exitCode ?? 0).toBe(0);
    lines.length = 0;
    await program.parseAsync(["instruction", "list"], { from: "user" });
    expect(lines).toEqual([`${id}\tPolski\t${text}`]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
