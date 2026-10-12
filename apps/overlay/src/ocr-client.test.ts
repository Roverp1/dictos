import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import * as errore from "../../../packages/errore/src/index.ts";
import { requestOcr } from "./ocr-client";

async function withServer(
  serve: (socket: net.Socket) => void,
  run: (socketPath: string) => Promise<void>
) {
  await using cleanup = new errore.AsyncDisposableStack();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-client-"));
  cleanup.defer(() => fs.rmSync(folder, { recursive: true, force: true }));
  const socketPath = path.join(folder, "socket");
  const server = net.createServer(serve);
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  cleanup.defer(
    () => new Promise<void>((resolve) => server.close(() => resolve()))
  );
  await run(socketPath);
}

test("preserves Polish UTF-8 split across socket reads and words without symbols", async () => {
  const response = Buffer.from(
    '{"words":[{"text":"coś","symbols":[]},{"text":"żółć"}]}\n'
  );
  const split = response.indexOf(Buffer.from("ś")) + 1;
  await withServer(
    (socket) =>
      socket.once("data", (command) => {
        expect(command.toString()).toBe("FULL 6\n");
        socket.write(response.subarray(0, split));
        setTimeout(() => socket.end(response.subarray(split)), 20);
      }),
    async (socketPath) => {
      const result = await requestOcr({ args: [socketPath, "full", "6"] });
      expect(result).toEqual({
        words: [{ text: "coś", symbols: [] }, { text: "żółć" }],
      });
    }
  );
});

test("returns error values for malformed JSON, non-OCR responses and invalid UTF-8", async () => {
  const responses = [
    Buffer.from("{}\n"),
    Buffer.from("null\n"),
    Buffer.from("[]\n"),
    Buffer.from("broken\n"),
    Buffer.concat([
      Buffer.from('{"words":[{"text":"'),
      Buffer.from([0xff]),
      Buffer.from('"}]}\n'),
    ]),
  ];
  for (const response of responses) {
    await withServer(
      (socket) => socket.once("data", () => socket.end(response)),
      async (socketPath) => {
        const result = await requestOcr({ args: [socketPath, "full", "3"] });
        expect(result instanceof Error).toBe(true);
      }
    );
  }
});

test("rejects unsupported PSM, invalid regions and command injection before connecting", async () => {
  for (const args of [
    [],
    ["/missing", "full", "7"],
    ["/missing", "full", "6\nFULL 3"],
    ["/missing", "crop", "0", "0", "0", "10", "6"],
    ["/missing", "crop", "-1", "0", "10", "10", "6"],
    ["/missing", "crop", "0", "0", "2147483648", "10", "6"],
    ["/missing", "crop", "0", "0", "10", "10", "6", "extra"],
    ["bad\0socket", "full", "6"],
  ]) {
    const result = await requestOcr({ args });
    expect(result instanceof Error).toBe(true);
    if (result instanceof Error)
      expect(result.message).toBe("Invalid OCR request.");
  }
});

test("bounds total response time even when a peer keeps sending partial data", async () => {
  await withServer(
    (socket) =>
      socket.once("data", () => {
        const interval = setInterval(() => socket.write(" "), 10);
        const end = setTimeout(() => {
          clearInterval(interval);
          socket.end();
        }, 250);
        socket.once("close", () => {
          clearInterval(interval);
          clearTimeout(end);
        });
      }),
    async (socketPath) => {
      const result = await requestOcr({
        args: [socketPath, "full", "6"],
        timeoutMs: 40,
      });
      expect(result instanceof Error).toBe(true);
      if (result instanceof Error)
        expect(result.message).toBe("OCR server timed out.");
    }
  );
});

test("returns errors for EOF, oversized output and helper failures, then allows a new request", async () => {
  for (const response of [
    "",
    '{"words":[]}',
    "x".repeat(256),
    '{"error":"Could not decode screenshot."}\n',
  ]) {
    await withServer(
      (socket) => socket.once("data", () => socket.end(response)),
      async (socketPath) => {
        const result = await requestOcr({
          args: [socketPath, "full", "6"],
          maxResponseBytes: 128,
        });
        expect(result instanceof Error).toBe(true);
      }
    );
  }
  await withServer(
    (socket) => socket.once("data", () => socket.end('{"words":[]}\n')),
    async (socketPath) => {
      expect(await requestOcr({ args: [socketPath, "full", "11"] })).toEqual({
        words: [],
      });
    }
  );
});

test("script emits one JSON error line with nonzero status for invalid args and unavailable helper", async () => {
  await using cleanup = new errore.DisposableStack();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-process-"));
  cleanup.defer(() => fs.rmSync(folder, { recursive: true, force: true }));
  for (const [args, code] of [
    [[], 2],
    [[path.join(folder, "missing"), "full", "6"], 1],
  ] as const) {
    const process = Bun.spawn(
      ["bun", path.join(import.meta.dir, "ocr-client.ts"), ...args],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(process.stdout).text();
    expect(await process.exited).toBe(code);
    expect(output.trim().split("\n")).toHaveLength(1);
    expect(typeof JSON.parse(output).error).toBe("string");
    expect(await new Response(process.stderr).text()).toBe("");
  }
});
