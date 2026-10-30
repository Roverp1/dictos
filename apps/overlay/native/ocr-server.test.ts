import { expect, test } from "bun:test";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import * as errore from "../../../packages/errore/src/index.ts";

const serverPath = path.join(import.meta.dir, "ocr-server");
const clientPath = path.join(import.meta.dir, "../src/ocr-client.ts");

class NativeOcrTestError extends errore.createTaggedError({
  name: "NativeOcrTestError",
  message: "$reason",
}) {}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OcrResponse {
  words: (Box & { text: string; line: string; symbols: Box[] })[];
  width: number;
  height: number;
  elapsedMs: number;
  symbolCount: number;
  coordinateSpace: string;
  region?: Box;
}

function parseJson<T extends object>(input: string | Uint8Array) {
  return errore.try(
    () =>
      JSON.parse(
        typeof input === "string"
          ? input
          : new TextDecoder("utf-8", { fatal: true }).decode(input)
      ) as T,
    (cause) =>
      new NativeOcrTestError({ reason: "Invalid JSON response.", cause })
  );
}

function workspace(cleanup: errore.AsyncDisposableStack) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "dictos-ocr-"));
  cleanup.defer(() => fs.rmSync(folder, { recursive: true, force: true }));
  return {
    folder,
    image: path.join(folder, "fixture.png"),
    address: path.join(folder, "socket"),
  };
}

function spawnProcess({
  cleanup,
  args,
  timeoutMs = 30_000,
}: {
  cleanup: errore.AsyncDisposableStack;
  args: string[];
  timeoutMs?: number;
}) {
  const child = errore.try(
    () =>
      Bun.spawn(args, {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        timeout: timeoutMs,
      }),
    (cause) =>
      new NativeOcrTestError({ reason: "Could not start process.", cause })
  );
  if (child instanceof Error) throw child;
  const stderr = new Response(child.stderr)
    .text()
    .catch(
      (cause) =>
        new NativeOcrTestError({ reason: "Could not read stderr.", cause })
    );
  cleanup.defer(async () => {
    if (child.exitCode === null) {
      child.kill();
      const exitCode = await waitForExit(child);
      if (exitCode instanceof Error) {
        child.kill("SIGKILL");
        await child.exited;
        throw exitCode;
      }
    }
    const result = await stderr;
    if (result instanceof Error) throw result;
  });
  return { child, stderr };
}

async function waitForExit(child: ReturnType<typeof spawnProcess>["child"]) {
  using timers = new errore.DisposableStack();
  const timeout = Promise.withResolvers<NativeOcrTestError>();
  const deadline = setTimeout(
    () =>
      timeout.resolve(
        new NativeOcrTestError({ reason: "Helper did not terminate." })
      ),
    5_000
  );
  timers.defer(() => clearTimeout(deadline));
  return Promise.race([child.exited, timeout.promise]);
}

async function run({
  args,
  timeoutMs = 10_000,
}: {
  args: string[];
  timeoutMs?: number;
}) {
  await using cleanup = new errore.AsyncDisposableStack();
  const { child, stderr } = spawnProcess({ cleanup, args, timeoutMs });
  const [stdout, errors, exitCode] = await Promise.all([
    new Response(child.stdout)
      .text()
      .catch(
        (cause) =>
          new NativeOcrTestError({ reason: "Could not read stdout.", cause })
      ),
    stderr,
    child.exited,
  ]);
  if (stdout instanceof Error) throw stdout;
  if (errors instanceof Error) throw errors;
  return { stdout, stderr: errors, exitCode };
}

async function fixture({
  image,
  text = true,
}: {
  image: string;
  text?: boolean;
}) {
  const result = await run({
    args: [
      "magick",
      "-size",
      "800x300",
      "xc:white",
      ...(text
        ? [
            "-font",
            "DejaVu-Sans",
            "-pointsize",
            "48",
            "-fill",
            "black",
            "-annotate",
            "+50+90",
            "HELLO WORLD",
            "-annotate",
            "+50+240",
            "SECOND LINE",
          ]
        : []),
      image,
    ],
  });
  expect(result.exitCode, result.stderr).toBe(0);
}

async function readyLine(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let response = "";
  while (response.length < 4_096) {
    const chunk = await reader.read().catch(
      (cause) =>
        new NativeOcrTestError({
          reason: "Could not read helper readiness.",
          cause,
        })
    );
    if (chunk instanceof Error) return chunk;
    if (chunk.done)
      return new NativeOcrTestError({
        reason: "Helper exited before readiness.",
      });
    response += decoder.decode(chunk.value, { stream: true });
    const newline = response.indexOf("\n");
    if (newline >= 0)
      return parseJson<{ ready: boolean }>(response.slice(0, newline));
  }
  return new NativeOcrTestError({
    reason: "Helper readiness response too large.",
  });
}

async function session({
  cleanup,
  image,
  address,
  language = "eng",
}: {
  cleanup: errore.AsyncDisposableStack;
  image: string;
  address: string;
  language?: string;
}) {
  const { child } = spawnProcess({
    cleanup,
    args: [serverPath, address, image, language],
    timeoutMs: 60_000,
  });
  await using reads = new errore.AsyncDisposableStack();
  const reader = child.stdout.getReader();
  reads.defer(async () => {
    await reader.cancel();
    reader.releaseLock();
  });
  const timeout = Promise.withResolvers<NativeOcrTestError>();
  const deadline = setTimeout(
    () =>
      timeout.resolve(
        new NativeOcrTestError({ reason: "Helper did not become ready." })
      ),
    15_000
  );
  reads.defer(() => clearTimeout(deadline));
  const ready = await Promise.race([readyLine(reader), timeout.promise]);
  if (ready instanceof Error) throw ready;
  expect(ready.ready).toBe(true);
  return child;
}

async function connect({
  cleanup,
  address,
}: {
  cleanup: errore.AsyncDisposableStack;
  address: string;
}) {
  const socket = errore.try(
    () => net.createConnection(address),
    (cause) =>
      new NativeOcrTestError({ reason: "Could not connect to helper.", cause })
  );
  if (socket instanceof Error) throw socket;
  cleanup.defer(() => {
    socket.destroy();
  });
  using timers = new errore.DisposableStack();
  const result = await new Promise<net.Socket | NativeOcrTestError>(
    (resolve) => {
      const deadline = setTimeout(
        () =>
          resolve(
            new NativeOcrTestError({ reason: "Helper connection timed out." })
          ),
        5_000
      );
      timers.defer(() => clearTimeout(deadline));
      socket.once("connect", () => resolve(socket));
      socket.once("error", (cause) =>
        resolve(
          new NativeOcrTestError({
            reason: "Could not connect to helper.",
            cause,
          })
        )
      );
    }
  );
  if (result instanceof Error) throw result;
  return result;
}

async function write({
  socket,
  command,
}: {
  socket: net.Socket;
  command: string;
}) {
  const result = await new Promise<NativeOcrTestError | null>((resolve) => {
    socket.write(command, (cause) =>
      resolve(
        cause
          ? new NativeOcrTestError({
              reason: "Could not send helper request.",
              cause,
            })
          : null
      )
    );
  });
  if (result instanceof Error) throw result;
}

async function request<T extends object = OcrResponse>({
  address,
  command,
  endRequest = false,
  timeoutMs = 30_000,
}: {
  address: string;
  command: string;
  endRequest?: boolean;
  timeoutMs?: number;
}) {
  await using cleanup = new errore.AsyncDisposableStack();
  const socket = await connect({ cleanup, address });
  const result = await new Promise<T | NativeOcrTestError>((resolve) => {
    const chunks: Buffer[] = [];
    const deadline = setTimeout(
      () =>
        resolve(
          new NativeOcrTestError({ reason: "Helper request timed out." })
        ),
      timeoutMs
    );
    cleanup.defer(() => clearTimeout(deadline));
    socket.on("data", (data: Buffer) => chunks.push(data));
    socket.once("end", () => resolve(parseJson<T>(Buffer.concat(chunks))));
    socket.once("error", (cause) =>
      resolve(
        new NativeOcrTestError({ reason: "Helper request failed.", cause })
      )
    );
    if (endRequest) socket.end(command);
    else socket.write(command);
  });
  if (result instanceof Error) throw result;
  return result;
}

test("invalid requests recover and crop padding clips at screenshot edges", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  await fixture({ image });
  await session({ cleanup, image, address });
  for (const command of [
    "",
    "FULL",
    "FULL 7",
    "FULL 6 extra",
    "FULL 6.0",
    "QUIT",
    "CROP -1 0 10 10 6",
    "CROP 0 0 0 10 6",
    "CROP 799 0 2 10 6",
    "CROP 0 300 1 1 6",
    "CROP 0 0 9223372036854775807 10 6",
    "x".repeat(128),
  ]) {
    expect(
      await request<{ error: string }>({ address, command: command + "\n" })
    ).toHaveProperty("error");
  }
  const result = await request({ address, command: "CROP 0 0 800 300 6\n" });
  expect(result.region).toEqual({ x: 0, y: 0, width: 800, height: 300 });
  for (const psm of [3, 6, 11]) {
    const full = await request({ address, command: `FULL ${psm}\n` });
    expect(full.words.map((word) => word.text)).toContain("HELLO");
  }
  const disconnected = await connect({ cleanup, address });
  await write({ socket: disconnected, command: "FULL 6\n" });
  disconnected.destroy();
  expect(
    (await request({ address, command: "FULL 6\n" })).words.length
  ).toBeGreaterThan(0);
}, 45_000);

test("missing and invalid screenshots can be retried and blank OCR has no symbols", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  const helper = await session({ cleanup, image, address });
  expect(
    await request<{ error: string }>({ address, command: "FULL 6\n" })
  ).toHaveProperty("error");
  fs.writeFileSync(image, "not an image");
  expect(
    await request<{ error: string }>({ address, command: "FULL 6\n" })
  ).toHaveProperty("error");
  await fixture({ image, text: false });
  const result = await request({ address, command: "FULL 6\n" });
  expect(result.words).toEqual([]);
  expect(result.symbolCount).toBe(0);
  expect(
    (await request({ address, command: "CROP 0 0 10 10 6\n" })).words
  ).toEqual([]);
  helper.kill();
  const exitCode = await waitForExit(helper);
  if (exitCode instanceof Error) throw exitCode;
  expect(exitCode).toBe(0);
  expect(fs.existsSync(address)).toBe(false);
  expect(fs.existsSync(image)).toBe(true);
}, 45_000);

test("Polish OCR and the client process preserve Unicode", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  const fixtureResult = await run({
    args: [
      "magick",
      "-size",
      "800x200",
      "xc:white",
      "-font",
      "DejaVu-Sans",
      "-pointsize",
      "48",
      "-fill",
      "black",
      "-annotate",
      "+50+90",
      "coś żółć",
      image,
    ],
  });
  expect(fixtureResult.exitCode, fixtureResult.stderr).toBe(0);
  await session({ cleanup, image, address, language: "pol" });
  const result = await request({ address, command: "FULL 6\n" });
  expect(result.words.map((word) => word.text)).toEqual(["coś", "żółć"]);
  const client = await run({
    args: [process.execPath, clientPath, address, "full", "6"],
    timeoutMs: 30_000,
  });
  expect(client.exitCode, client.stderr).toBe(0);
  expect(client.stdout.trim().split("\n")).toHaveLength(1);
  const full = parseJson<OcrResponse>(client.stdout);
  if (full instanceof Error) throw full;
  expect(full.words).toEqual(result.words);
  const crop = await run({
    args: [
      process.execPath,
      clientPath,
      address,
      "crop",
      "30",
      "30",
      "400",
      "100",
      "6",
    ],
    timeoutMs: 30_000,
  });
  expect(crop.exitCode, crop.stderr).toBe(0);
  const cropped = parseJson<OcrResponse>(crop.stdout);
  if (cropped instanceof Error) throw cropped;
  expect(cropped.region).toEqual({ x: 10, y: 10, width: 440, height: 140 });
}, 45_000);

test("startup failures preserve existing files and emit a finite failure record", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { folder, image, address } = workspace(cleanup);
  fs.writeFileSync(address, "keep me");
  for (const args of [
    [address, image, "eng"],
    [path.join(folder, "new"), image, "missing-language"],
    [path.join(folder, "x".repeat(110)), image, "eng"],
    [],
  ]) {
    const result = await run({
      args: [serverPath, ...args],
      timeoutMs: 15_000,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout.endsWith("\n")).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(16_384);
    expect(parseJson(result.stdout)).toMatchObject({
      ready: false,
      error: {
        code: expect.stringMatching(
          /^OCR_(STARTUP_FAILED|INITIALIZATION_FAILED|LANGUAGE_UNAVAILABLE)$/
        ),
      },
    });
  }
  expect(fs.readFileSync(address, "utf8")).toBe("keep me");
  expect(fs.existsSync(path.join(folder, "new"))).toBe(false);
}, 45_000);

test("a partially available language combination never publishes readiness", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  const result = await run({
    args: [serverPath, address, image, "eng+dictos_missing_language"],
    timeoutMs: 15_000,
  });
  expect(result.exitCode).not.toBe(0);
  expect(parseJson(result.stdout)).toEqual({
    ready: false,
    error: {
      code: "OCR_LANGUAGE_UNAVAILABLE",
      missingLanguages: ["dictos_missing_language"],
    },
  });
  expect(fs.existsSync(address)).toBe(false);
}, 20_000);

test("an explicitly available language combination serves real OCR without fallback", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  await fixture({ image });
  await session({ cleanup, image, address, language: "eng+pol" });
  const result = await request({ address, command: "FULL 6\n" });
  expect(result.words.map((word) => word.text)).toContain("HELLO");
}, 30_000);

test("truncated and stalled requests do not block the next OCR request", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  await fixture({ image });
  await session({ cleanup, image, address });
  for (const endRequest of [true, false]) {
    expect(
      await request<{ error: string }>({
        address,
        command: "FULL 6",
        endRequest,
        timeoutMs: 5_000,
      })
    ).toHaveProperty("error");
  }
  expect(
    (await request({ address, command: "FULL 6\n" })).words.length
  ).toBeGreaterThan(0);
}, 45_000);

test("private socket is removed on termination even with an incomplete request", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  const helper = await session({ cleanup, image, address });
  expect(fs.statSync(address).mode & 0o777).toBe(0o600);
  const socket = await connect({ cleanup, address });
  await write({ socket, command: "FULL" });
  helper.kill();
  const exitCode = await waitForExit(helper);
  if (exitCode instanceof Error) throw exitCode;
  expect(exitCode).toBe(0);
  expect(fs.existsSync(address)).toBe(false);
  expect(fs.existsSync(image)).toBe(false);
}, 45_000);

test("full-crop-full OCR retains the image and screenshot geometry", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const { image, address } = workspace(cleanup);
  await session({ cleanup, image, address });
  await fixture({ image });
  const first = await request({ address, command: "FULL 6\n" });
  fs.unlinkSync(image);
  const crop = await request({ address, command: "CROP 30 30 500 100 6\n" });
  const last = await request({ address, command: "FULL 6\n" });
  expect(first.words).toEqual(last.words);
  expect(first.words.map((word) => word.text)).toContain("HELLO");
  expect(last.words.map((word) => word.text)).toContain("SECOND");
  expect(crop.words.map((word) => word.text)).not.toContain("SECOND");
  expect(crop.region).toEqual({ x: 10, y: 10, width: 540, height: 140 });
  for (const result of [first, crop, last]) {
    expect(result.coordinateSpace).toBe("screenshot");
    expect([result.width, result.height]).toEqual([800, 300]);
    expect(result.elapsedMs).toBeGreaterThan(0);
    expect(result.symbolCount).toBe(
      result.words.reduce((count, word) => count + word.symbols.length, 0)
    );
    expect(result.symbolCount).toBeGreaterThan(0);
    const region = result.region ?? { x: 0, y: 0, width: 800, height: 300 };
    for (const word of result.words) {
      expect(word.line).toBeTruthy();
      for (const box of [word, ...word.symbols]) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
        expect(box.x).toBeGreaterThanOrEqual(region.x);
        expect(box.y).toBeGreaterThanOrEqual(region.y);
        expect(box.x + box.width).toBeLessThanOrEqual(region.x + region.width);
        expect(box.y + box.height).toBeLessThanOrEqual(
          region.y + region.height
        );
      }
    }
  }
}, 45_000);
