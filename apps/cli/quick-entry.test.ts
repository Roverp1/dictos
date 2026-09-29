import { test, expect } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cliDir = import.meta.dir;
const script = path.join(cliDir, "quick-entry.sh");

const desktopCommands = {
  slurp: `#!/usr/bin/env bash
if [[ "$SLURP_CANCEL" == 1 ]]; then
  printf 'selection cancelled\n' >&2
  exit 1
fi
if [[ "$SLURP_FAILURE" == 1 ]]; then
  printf 'failed to create display\n' >&2
  exit 1
fi
printf '0,0 100x30\n'
`,
  grim: `#!/usr/bin/env bash
if [[ "$GRIM_FAILURE" == 1 ]]; then
  printf 'screencopy unavailable\n' >&2
  exit 1
fi
printf 'image data'
`,
  tesseract: `#!/usr/bin/env bash
cat >/dev/null
printf '%s\n' "$*" > "$OCR_ARGS_LOG"
if [[ "$OCR_FAILURE" == 1 ]]; then
  printf 'OCR failed\n' >&2
  exit 1
fi
printf '%s\n' "$OCR_TEXT"
`,
  "notify-send": `#!/usr/bin/env bash
printf '%s\n' "$*" >> "$NOTIFICATION_LOG"
`,
};

async function withFixture(
  run: (fixture: {
    launch: (args?: string[], overrides?: Record<string, string>) => Result;
    cli: (args: string[]) => Result;
    notificationLog: string;
    ocrArgsLog: string;
    dataDir: string;
  }) => Promise<void>
) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "dictos-quick-entry-"));
  const binDir = path.join(root, "bin");
  const dataDir = path.join(root, "data");
  const notificationLog = path.join(root, "notifications");
  const ocrArgsLog = path.join(root, "ocr-args");

  try {
    await fsp.mkdir(binDir);
    await Promise.all(
      Object.entries(desktopCommands).map(([name, content]) =>
        fsp.writeFile(path.join(binDir, name), content, { mode: 0o755 })
      )
    );

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      XDG_DATA_HOME: dataDir,
      NOTIFICATION_LOG: notificationLog,
      OCR_ARGS_LOG: ocrArgsLog,
      OCR_TEXT: "  hello\nworld  ",
      SLURP_CANCEL: "0",
      SLURP_FAILURE: "0",
      GRIM_FAILURE: "0",
      OCR_FAILURE: "0",
    };

    const execute = (
      command: string[],
      overrides: Record<string, string> = {}
    ) => {
      const result = Bun.spawnSync(command, {
        cwd: root,
        env: { ...env, ...overrides },
        stdout: "pipe",
        stderr: "pipe",
      });
      return {
        status: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    };

    await run({
      launch: (args = [], overrides = {}) =>
        execute(["bash", script, ...args], overrides),
      cli: (args) =>
        execute([process.execPath, "--cwd", cliDir, "src/index.ts", ...args]),
      notificationLog,
      ocrArgsLog,
      dataDir,
    });
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

type Result = { status: number; stdout: string; stderr: string };

test("saves one normalized Entry in the root Folder without success output", async () => {
  await withFixture(async ({ launch, cli, notificationLog }) => {
    expect(launch()).toEqual({ status: 0, stdout: "", stderr: "" });

    const listed = cli(["entry", "list"]);
    expect(listed.status).toBe(0);
    expect(listed.stdout).toMatch(/\thello world\n$/);
    expect(fs.existsSync(notificationLog)).toBe(false);
  });
});

test("can choose a Folder and OCR language and opt into output and notification", async () => {
  await withFixture(async ({ launch, cli, notificationLog, ocrArgsLog }) => {
    const folder = cli(["folder", "create", "--name", "Phrases"]);
    expect(folder.status).toBe(0);
    const folderId = folder.stdout.trim();
    const text = "A full Entry with punctuation: <b>& quotes!";

    const result = launch(
      ["--folder", folderId, "--lang", "deu", "--verbose", "--notify-success"],
      { OCR_TEXT: text, DICTOS_OCR_LANG: "eng" }
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(new RegExp(`^${text}\n[0-9a-f-]+\n$`));
    expect(cli(["entry", "list", "--folder", folderId]).stdout).toContain(
      `\t${text}\n`
    );
    expect(await fsp.readFile(ocrArgsLog, "utf8")).toContain("-l deu");
    expect(await fsp.readFile(notificationLog, "utf8")).toContain(text);
  });
});

test("uses the configured OCR language when no flag is passed", async () => {
  await withFixture(async ({ launch, ocrArgsLog }) => {
    expect(launch([], { DICTOS_OCR_LANG: "eng+deu" }).status).toBe(0);
    expect(await fsp.readFile(ocrArgsLog, "utf8")).toContain("-l eng+deu");
  });
});

test("cancels without creating an Entry or notifying", async () => {
  await withFixture(async ({ launch, dataDir, notificationLog }) => {
    expect(launch([], { SLURP_CANCEL: "1" })).toEqual({
      status: 0,
      stdout: "",
      stderr: "",
    });
    expect(fs.existsSync(dataDir)).toBe(false);
    expect(fs.existsSync(notificationLog)).toBe(false);
  });
});

test("reports a broken screen selection rather than treating it as cancellation", async () => {
  await withFixture(async ({ launch, dataDir, notificationLog }) => {
    const result = launch([], { SLURP_FAILURE: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Screen selection failed");
    expect(fs.existsSync(dataDir)).toBe(false);
    expect(await fsp.readFile(notificationLog, "utf8")).toContain(
      "Screen selection failed"
    );
  });
});

test("does not create an Entry for empty OCR output", async () => {
  await withFixture(async ({ launch, dataDir, notificationLog }) => {
    const result = launch([], { OCR_TEXT: "  \n\t " });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No text recognized");
    expect(fs.existsSync(dataDir)).toBe(false);
    expect(await fsp.readFile(notificationLog, "utf8")).toContain(
      "No text recognized"
    );
  });
});

test("does not save an Entry when screenshot capture fails", async () => {
  await withFixture(async ({ launch, dataDir, notificationLog }) => {
    const result = launch([], { GRIM_FAILURE: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Screenshot or OCR failed");
    expect(fs.existsSync(dataDir)).toBe(false);
    expect(await fsp.readFile(notificationLog, "utf8")).toContain(
      "Screenshot or OCR failed"
    );
  });
});

test("propagates CLI failure and notifies without claiming success", async () => {
  await withFixture(async ({ launch, notificationLog }) => {
    const result = launch(["--folder", "missing", "--notify-success"]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Could not save Entry");
    const notification = await fsp.readFile(notificationLog, "utf8");
    expect(notification).toContain("Dictos Entry failed");
    expect(notification).not.toContain("Dictos Entry saved");
  });
});
