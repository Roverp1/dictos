import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as errore from "@dictos/errore";

const overlay = path.resolve(import.meta.dir, "..");
const fixtureImage = path.join(overlay, "tests/fixture.png");

function workspace(cleanup: errore.DisposableStack) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dictos-launch-"));
  cleanup.defer(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = path.join(directory, "config/dictos");
  fs.mkdirSync(config, { recursive: true });
  const shell = path.join(directory, "shell");
  fs.mkdirSync(shell);
  fs.copyFileSync(
    path.join(import.meta.dir, "fixtures/configuration-shell.qml"),
    path.join(shell, "shell.qml")
  );
  // Quickshell confines local imports to its config root. Keep production code live.
  fs.symlinkSync(path.join(overlay, "qml"), path.join(shell, "production"));
  const runtime = path.join(directory, "runtime");
  fs.mkdirSync(runtime, { mode: 0o700 });
  return {
    directory,
    config,
    shell,
    runtime,
    env: {
      ...process.env,
      XDG_RUNTIME_DIR: runtime,
      XDG_CONFIG_HOME: path.join(directory, "config"),
      XDG_DATA_HOME: path.join(directory, "data"),
      DICTOS_OVERLAY_CONFIG_SNAPSHOT: undefined,
      DICTOS_OCR_LANG: undefined,
      QT_QPA_PLATFORM: "offscreen",
      QT_QUICK_BACKEND: "software",
    },
  };
}

test("sourcing the launch coordinator performs no startup work", async () => {
  using cleanup = new errore.DisposableStack();
  const fixture = workspace(cleanup);
  const child = Bun.spawn(
    [
      "bash",
      "-c",
      'source "$1"; declare -F run_overlay >/dev/null',
      "fixture",
      path.join(overlay, "launch.sh"),
    ],
    { env: fixture.env, stdout: "pipe", stderr: "pipe" }
  );
  const stderr = await new Response(child.stderr).text();
  expect(await child.exited, stderr).toBe(0);
  expect(fs.readdirSync(fixture.config)).toEqual([]);
});

test.each([["eng", "dictos_missing_language"], ["dictos_missing_language"]])(
  "launcher reports unavailable OCR languages %j before cleanup without opening Quickshell",
  async (...languages) => {
    using cleanup = new errore.DisposableStack();
    const fixture = workspace(cleanup);
    fs.writeFileSync(
      path.join(fixture.config, "overlay.toml"),
      "[ocr]\nlanguages = " + JSON.stringify(languages) + "\n"
    );
    const child = Bun.spawn(
      [
        "bash",
        "-c",
        'source "$1"; run_overlay "$2" --image "$3" --output fixture',
        "fixture",
        path.join(overlay, "launch.sh"),
        fixture.shell,
        fixtureImage,
      ],
      {
        env: {
          ...fixture.env,
          DICTOS_CONFIGURATION_FIXTURE: fixture.directory,
        },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 20_000,
      }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("dictos_missing_language");
    expect(stderr).toContain("Tesseract");
    expect(stderr).not.toContain("Error opening data file");
    expect(stdout + stderr).not.toContain("CONFIGURATION_FIXTURE_STARTED");
    expect(fs.existsSync(path.join(fixture.directory, "captured.json"))).toBe(
      false
    );
    expect(fs.existsSync(fixtureImage)).toBe(true);
    expect(fs.readdirSync(fixture.runtime)).toEqual([]);
  },
  30_000
);

test("production launcher preserves a bootstrap configuration summary before capture or native startup", async () => {
  using cleanup = new errore.DisposableStack();
  const fixture = workspace(cleanup);
  fs.writeFileSync(
    path.join(fixture.config, "config.toml"),
    '[logging]\nlevel = "INVALID_PRIVATE"\n'
  );
  const child = Bun.spawn(
    ["bash", path.join(overlay, "run.sh"), "--output", "fixture"],
    { env: fixture.env, stdout: "pipe", stderr: "pipe", timeout: 20_000 }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode).not.toBe(0);
  expect(stderr).toContain("config.toml");
  expect(stderr).toContain("logging.level");
  expect(stderr).not.toContain("INVALID_PRIVATE");
  expect(stdout).toBe("");
  expect(fs.readdirSync(fixture.runtime)).toEqual([]);
  expect(fs.existsSync(path.join(fixture.directory, "data"))).toBe(false);
}, 25_000);

async function waitForFile({
  file,
  child,
}: {
  file: string;
  child: Bun.Subprocess;
}) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (fs.existsSync(file)) return true;
    if (child.exitCode !== null) return false;
    await Bun.sleep(20);
  }
  return false;
}

test("real launch handoff retains its snapshot and CLI log threshold after TOML becomes invalid", async () => {
  using cleanup = new errore.DisposableStack();
  const fixture = workspace(cleanup);
  fs.writeFileSync(
    path.join(fixture.config, "config.toml"),
    '[generation]\ndefault_model = "openai/global"\n[logging]\nlevel = "fatal"\n'
  );
  fs.writeFileSync(
    path.join(fixture.config, "cli.toml"),
    '[overrides.logging]\nlevel = "debug"\n'
  );
  fs.writeFileSync(
    path.join(fixture.config, "overlay.toml"),
    '[overrides.generation]\ndefault_model = "google/opening"\n[ocr]\nlanguages = ["eng", "pol"]\n'
  );
  fs.writeFileSync(path.join(fixture.directory, "continue"), "wait");
  const child = Bun.spawn(
    [
      "bash",
      "-c",
      'source "$1"; run_overlay "$2" --image "$3" --output fixture',
      "fixture",
      path.join(overlay, "launch.sh"),
      fixture.shell,
      fixtureImage,
    ],
    {
      env: { ...fixture.env, DICTOS_CONFIGURATION_FIXTURE: fixture.directory },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    }
  );
  cleanup.defer(() => {
    if (child.exitCode === null) child.kill();
  });
  const output = new Response(child.stdout).text();
  const errors = new Response(child.stderr).text();
  const capturedPath = path.join(fixture.directory, "captured.json");
  const captured = await waitForFile({ file: capturedPath, child });
  if (!captured) {
    child.kill();
    expect(captured, (await output) + (await errors)).toBe(true);
    return;
  }
  expect(JSON.parse(fs.readFileSync(capturedPath, "utf8")).settings).toEqual({
    defaultModel: "google/opening",
    logLevel: "debug",
    ocrLanguages: ["eng", "pol"],
  });
  for (const name of ["config.toml", "cli.toml", "overlay.toml"])
    fs.writeFileSync(path.join(fixture.config, name), "invalid = [\n");
  fs.writeFileSync(path.join(fixture.directory, "continue"), "run");
  expect(await child.exited, (await output) + (await errors)).toBe(0);
  const results = JSON.parse(
    fs.readFileSync(path.join(fixture.directory, "result.json"), "utf8")
  );
  expect(results.models).toEqual({
    response: { ok: true, data: [] },
    revision: 11,
  });
  expect(results.state).toEqual({
    response: {
      ok: true,
      data: { version: 1, instructionText: "", selectedTypes: ["definition"] },
    },
    revision: 12,
  });
  const log = fs
    .readFileSync(
      path.join(fixture.directory, "data/dictos/dictos-cli.log"),
      "utf8"
    )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(log).toContainEqual(
    expect.objectContaining({ level: 20, operation: "models.list" })
  );
  expect(log.every((event) => event.level >= 20)).toBe(true);
  for (const name of ["config.toml", "cli.toml", "overlay.toml"])
    expect(fs.readFileSync(path.join(fixture.config, name), "utf8")).toBe(
      "invalid = [\n"
    );
  expect(fs.existsSync(fixtureImage)).toBe(true);

  fs.writeFileSync(
    path.join(fixture.config, "config.toml"),
    '[logging]\nlevel = "fatal"\n'
  );
  fs.writeFileSync(path.join(fixture.config, "cli.toml"), "");
  fs.writeFileSync(
    path.join(fixture.config, "overlay.toml"),
    '[overrides.generation]\ndefault_model = "openai/reopened"\n'
  );
  fs.unlinkSync(capturedPath);
  fs.unlinkSync(path.join(fixture.directory, "result.json"));
  fs.writeFileSync(path.join(fixture.directory, "continue"), "wait");
  const logBefore = fs.readFileSync(
    path.join(fixture.directory, "data/dictos/dictos-cli.log"),
    "utf8"
  );
  const reopened = Bun.spawn(
    [
      "bash",
      "-c",
      'source "$1"; run_overlay "$2" --image "$3" --output fixture',
      "fixture",
      path.join(overlay, "launch.sh"),
      fixture.shell,
      fixtureImage,
    ],
    {
      env: { ...fixture.env, DICTOS_CONFIGURATION_FIXTURE: fixture.directory },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    }
  );
  cleanup.defer(() => {
    if (reopened.exitCode === null) reopened.kill();
  });
  const reopenedOutput = new Response(reopened.stdout).text();
  const reopenedErrors = new Response(reopened.stderr).text();
  expect(await waitForFile({ file: capturedPath, child: reopened })).toBe(true);
  expect(JSON.parse(fs.readFileSync(capturedPath, "utf8")).settings).toEqual({
    defaultModel: "openai/reopened",
    logLevel: "fatal",
    ocrLanguages: ["eng"],
  });
  fs.writeFileSync(path.join(fixture.directory, "continue"), "run");
  expect(
    await reopened.exited,
    (await reopenedOutput) + (await reopenedErrors)
  ).toBe(0);
  const reopenedResults = JSON.parse(
    fs.readFileSync(path.join(fixture.directory, "result.json"), "utf8")
  );
  expect(reopenedResults.models.response).toEqual({ ok: true, data: [] });
  expect(reopenedResults.state.response.ok).toBe(true);
  expect(
    fs.readFileSync(
      path.join(fixture.directory, "data/dictos/dictos-cli.log"),
      "utf8"
    )
  ).toBe(logBefore);
}, 35_000);

test("invalid inherited snapshot fails at the QML child boundary with exit 5 and creates no config files", async () => {
  using cleanup = new errore.DisposableStack();
  const fixture = workspace(cleanup);
  fs.rmdirSync(fixture.config);
  const child = Bun.spawn(["qs", "-p", fixture.shell], {
    env: {
      ...fixture.env,
      DICTOS_CONFIGURATION_FIXTURE: fixture.directory,
      DICTOS_CONFIGURATION_INVALID: "1",
      DICTOS_CLI_PATH: path.resolve(overlay, "../cli/src/index.ts"),
      DICTOS_OVERLAY_CONFIG_SNAPSHOT: '{"version":99,"SECRET":"never print"}',
    },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode, stdout + stderr).toBe(0);
  const outcome = JSON.parse(
    fs.readFileSync(path.join(fixture.directory, "result.json"), "utf8")
  );
  expect(outcome.exitCode).toBe(5);
  expect(outcome.response.ok).toBe(false);
  expect(outcome.response.error.code).toBe("CONFIGURATION_ERROR");
  expect(outcome.response.error.message).toContain("startup snapshot");
  expect(outcome.response.error.message).toContain("version");
  expect(outcome.response.error.message).not.toContain("SECRET");
  expect(fs.existsSync(fixture.config)).toBe(false);
  expect(fs.existsSync(path.join(fixture.directory, "captured.json"))).toBe(
    false
  );
}, 35_000);

test("the supported language environment override replaces unavailable configured data for this opening", async () => {
  using cleanup = new errore.DisposableStack();
  const fixture = workspace(cleanup);
  fs.writeFileSync(
    path.join(fixture.config, "overlay.toml"),
    '[ocr]\nlanguages = ["dictos_missing_language"]\n'
  );
  fs.writeFileSync(path.join(fixture.directory, "continue"), "run");
  const child = Bun.spawn(
    [
      "bash",
      "-c",
      'source "$1"; run_overlay "$2" --image "$3" --output fixture',
      "fixture",
      path.join(overlay, "launch.sh"),
      fixture.shell,
      fixtureImage,
    ],
    {
      env: {
        ...fixture.env,
        DICTOS_OCR_LANG: "eng",
        DICTOS_CONFIGURATION_FIXTURE: fixture.directory,
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode, stdout + stderr).toBe(0);
  expect(
    JSON.parse(
      fs.readFileSync(path.join(fixture.directory, "captured.json"), "utf8")
    ).settings.ocrLanguages
  ).toEqual(["eng"]);
  expect(
    JSON.parse(
      fs.readFileSync(path.join(fixture.directory, "result.json"), "utf8")
    ).state.response.ok
  ).toBe(true);
  expect(
    fs.readFileSync(path.join(fixture.config, "overlay.toml"), "utf8")
  ).toBe('[ocr]\nlanguages = ["dictos_missing_language"]\n');
}, 35_000);
