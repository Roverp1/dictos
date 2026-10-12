import net from "node:net";
// Direct workspace source keeps this development script independent of package setup.
import * as errore from "../../../packages/errore/src/index.ts";

export class OcrClientError extends errore.createTaggedError({
  name: "OcrClientError",
  message: "$reason",
}) {}

export function requestOcr({
  args,
  timeoutMs = 120_000,
  maxResponseBytes = 20_000_000,
}: {
  args: readonly string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
}): Promise<Record<string, unknown> | OcrClientError> {
  const [socketPath, mode, ...values] = args;
  const command =
    mode === "full" && values.length === 1
      ? `FULL ${values[0]}`
      : mode === "crop" && values.length === 5
        ? `CROP ${values.join(" ")}`
        : null;
  const numbers = values.map(Number);
  const psm = numbers.at(-1);
  if (
    !socketPath ||
    socketPath.includes("\0") ||
    !command ||
    !values.every((value) => /^\d+$/.test(value)) ||
    !numbers.every(
      (value) => Number.isSafeInteger(value) && value <= 2_147_483_647
    ) ||
    (psm !== 3 && psm !== 6 && psm !== 11) ||
    (mode === "crop" && (numbers[2]! <= 0 || numbers[3]! <= 0)) ||
    Buffer.byteLength(command) >= 128 ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes <= 0
  )
    return Promise.resolve(
      new OcrClientError({ reason: "Invalid OCR request." })
    );

  return new Promise((resolve) => {
    const socket = errore.try(
      () => net.createConnection(socketPath),
      (cause) =>
        new OcrClientError({ reason: "OCR server unavailable.", cause })
    );
    if (socket instanceof Error) {
      resolve(socket);
      return;
    }
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let response = "";
    let bytes = 0;
    let settled = false;
    const finish = (result: Record<string, unknown> | OcrClientError) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      socket.destroy();
      resolve(result);
    };
    const deadline = setTimeout(
      () => finish(new OcrClientError({ reason: "OCR server timed out." })),
      timeoutMs
    );
    socket.on("connect", () => socket.write(command + "\n"));
    socket.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxResponseBytes) {
        finish(new OcrClientError({ reason: "OCR response too large." }));
        return;
      }
      const decoded = errore.try(
        () => decoder.decode(chunk, { stream: true }),
        (cause) =>
          new OcrClientError({ reason: "Invalid OCR UTF-8 response.", cause })
      );
      if (decoded instanceof Error) {
        finish(decoded);
        return;
      }
      response += decoded;
      const newline = response.indexOf("\n");
      if (newline < 0) return;
      const parsed = errore.try(
        () => JSON.parse(response.slice(0, newline)) as Record<string, unknown>,
        (cause) =>
          new OcrClientError({ reason: "Invalid OCR response.", cause })
      );
      if (parsed instanceof Error) {
        finish(parsed);
        return;
      }
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        finish(new OcrClientError({ reason: "Invalid OCR response." }));
        return;
      }
      if (typeof parsed.error === "string") {
        finish(new OcrClientError({ reason: parsed.error }));
        return;
      }
      if (!Array.isArray(parsed.words)) {
        finish(new OcrClientError({ reason: "Invalid OCR response." }));
        return;
      }
      finish(parsed);
    });
    socket.on("end", () =>
      finish(
        new OcrClientError({ reason: "OCR server closed without a response." })
      )
    );
    socket.on("error", (cause) =>
      finish(new OcrClientError({ reason: "OCR server unavailable.", cause }))
    );
  });
}

if (import.meta.main) {
  const result = await requestOcr({ args: process.argv.slice(2) });
  console.log(
    JSON.stringify(result instanceof Error ? { error: result.message } : result)
  );
  if (result instanceof Error)
    process.exitCode = result.message === "Invalid OCR request." ? 2 : 1;
}
