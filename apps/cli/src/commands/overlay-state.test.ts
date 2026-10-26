import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

import { createCliContext } from "../app/context";
import { CliExitCode } from "../app/types";
import { registerOverlayStateCommands } from "./overlay-state";
import { isolateProcessEnvironment } from "../app/cli-fixture";

const originalDataHome = process.env.XDG_DATA_HOME;

afterEach(() => {
  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;
  process.exitCode = 0;
});

async function fixture() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-overlay-state-cli-")
  );
  const restore = isolateProcessEnvironment(root);
  const dataDir = path.join(root, "dictos");

  async function run(args: string[], input = "") {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context = createCliContext();
    context.output = {
      writeData: (text) => stdout.push(text),
      writeError: (text) => stderr.push(text),
    };
    process.exitCode = 0;
    const program = new Command().name("dictos").exitOverride();
    const overlay = program.command("overlay");
    registerOverlayStateCommands(overlay, context, { input });
    await program.parseAsync(["overlay", "state", ...args], { from: "user" });
    return { stdout, stderr, exitCode: process.exitCode };
  }

  return {
    root,
    dataDir,
    run,
    cleanup: () => {
      restore();
      return fs.rm(root, { recursive: true, force: true });
    },
  };
}

test("state read returns defaults without opening the Dictionary", async () => {
  const f = await fixture();
  try {
    expect(await f.run(["read", "--json"])).toEqual({
      stdout: [
        JSON.stringify({
          ok: true,
          data: {
            version: 1,
            instructionText: "",
            selectedTypes: ["definition"],
          },
        }),
      ],
      stderr: [],
      exitCode: 0,
    });
    expect(await fs.readdir(f.dataDir)).not.toContain("dictos.db");
  } finally {
    await f.cleanup();
  }
});

test("state write and read preserve exact Instruction text and Types across invocations", async () => {
  const f = await fixture();
  try {
    const state = {
      version: 1,
      instructionText: "Żółć\nDruga linia",
      selectedTypes: ["example", "translation"],
    };
    expect(
      await f.run(["write", "--json"], `${JSON.stringify(state)}\n`)
    ).toEqual({
      stdout: [JSON.stringify({ ok: true, data: state })],
      stderr: [],
      exitCode: 0,
    });
    expect(await f.run(["read", "--json"])).toEqual({
      stdout: [JSON.stringify({ ok: true, data: state })],
      stderr: [],
      exitCode: 0,
    });
    expect(await fs.readdir(f.dataDir)).not.toContain("dictos.db");
  } finally {
    await f.cleanup();
  }
});

test("invalid writer payload returns a safe JSON error and does not replace state", async () => {
  const f = await fixture();
  try {
    const initial = {
      version: 1,
      instructionText: "saved",
      selectedTypes: ["definition"],
    };
    expect(
      (await f.run(["write", "--json"], `${JSON.stringify(initial)}\n`))
        .exitCode
    ).toBe(0);
    for (const input of [
      { version: 2, instructionText: "secret", selectedTypes: ["definition"] },
      { version: 1, instructionText: null, selectedTypes: ["definition"] },
      { version: 1, instructionText: "secret", selectedTypes: ["bad"] },
    ]) {
      expect(
        await f.run(["write", "--json"], `${JSON.stringify(input)}\n`)
      ).toEqual({
        stdout: [
          '{"ok":false,"error":{"code":"INVALID_REQUEST","message":"Invalid JSON request"}}',
        ],
        stderr: [],
        exitCode: CliExitCode.ExpectedFailure,
      });
    }
    expect(await f.run(["read", "--json"])).toEqual({
      stdout: [JSON.stringify({ ok: true, data: initial })],
      stderr: [],
      exitCode: 0,
    });
    expect(await fs.readdir(f.dataDir)).not.toContain("dictos.db");
  } finally {
    await f.cleanup();
  }
});

test("corrupt state returns a safe JSON error without overwriting the file", async () => {
  const f = await fixture();
  try {
    const directory = path.join(f.dataDir, "overlay-capture");
    await fs.mkdir(directory, { recursive: true });
    const file = path.join(directory, "state.json");
    await fs.writeFile(file, '{"instructionText":"private broken data"');
    expect(await f.run(["read", "--json"])).toEqual({
      stdout: [
        '{"ok":false,"error":{"code":"OPERATION_FAILED","message":"Operation failed"}}',
      ],
      stderr: [],
      exitCode: CliExitCode.ExpectedFailure,
    });
    expect(await fs.readFile(file, "utf8")).toBe(
      '{"instructionText":"private broken data"'
    );
    expect(await fs.readdir(f.dataDir)).not.toContain("dictos.db");
  } finally {
    await f.cleanup();
  }
});

test("blank Instruction clears previous text, and malformed input stays off stdout", async () => {
  const f = await fixture();
  try {
    const state = { version: 1, instructionText: "", selectedTypes: [] };
    expect(
      (
        await f.run(
          ["write", "--json"],
          `${JSON.stringify({ ...state, instructionText: "old" })}\n`
        )
      ).exitCode
    ).toBe(0);
    expect(
      (await f.run(["write", "--json"], `${JSON.stringify(state)}\n`)).exitCode
    ).toBe(0);
    expect(await f.run(["read", "--json"])).toEqual({
      stdout: [JSON.stringify({ ok: true, data: state })],
      stderr: [],
      exitCode: 0,
    });
    expect(
      await f.run(["write", "--json"], '{"instructionText":"private"\n')
    ).toEqual({
      stdout: [
        '{"ok":false,"error":{"code":"INVALID_REQUEST","message":"Invalid JSON request"}}',
      ],
      stderr: [],
      exitCode: CliExitCode.ExpectedFailure,
    });
  } finally {
    await f.cleanup();
  }
});
