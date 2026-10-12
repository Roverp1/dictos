import * as errore from "@dictos/errore";

const MAX_REQUEST_BYTES = 1024 * 1024;

class InvalidOverlayJsonRequestError extends errore.createTaggedError({
  name: "InvalidOverlayJsonRequestError",
  message: "Invalid JSON request",
}) {}

class OverlayJsonRequestTooLargeError extends errore.createTaggedError({
  name: "OverlayJsonRequestTooLargeError",
  message: "JSON request is too large",
}) {}

class OverlayJsonReadError extends errore.createTaggedError({
  name: "OverlayJsonReadError",
  message: "Could not read JSON request",
}) {}

export type OverlayJsonErrorCode =
  "OPERATION_FAILED" | "DATABASE_IN_USE" | "MODEL_UNAVAILABLE";

const handledMessages: Record<OverlayJsonErrorCode, string> = {
  OPERATION_FAILED: "Operation failed",
  DATABASE_IN_USE: "Dictos database is already open by another process",
  MODEL_UNAVAILABLE: "Selected Model is unavailable",
};

export type OverlayCliResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const parseLine = <T>(
  line: Uint8Array,
  validate: (value: unknown) => T | Error
): T | Error => {
  if (line.byteLength > MAX_REQUEST_BYTES)
    return new OverlayJsonRequestTooLargeError();

  const text = errore.try(
    () => new TextDecoder("utf-8", { fatal: true }).decode(line),
    (cause) => new InvalidOverlayJsonRequestError({ cause })
  );
  if (text instanceof Error) return text;

  const value = errore.try(
    () => JSON.parse(text) as unknown,
    (cause) => new InvalidOverlayJsonRequestError({ cause })
  );
  if (value instanceof Error) return value;

  const result = validate(value);
  if (result instanceof Error)
    return new InvalidOverlayJsonRequestError({ cause: result });
  return result;
};

export async function readOverlayJsonRequest<T>({
  input,
  validate,
}: {
  input: string | ReadableStream<Uint8Array>;
  validate: (value: unknown) => T | Error;
}): Promise<T | Error> {
  if (typeof input === "string") {
    const line = input.endsWith("\n") ? input.slice(0, -1) : input;
    if (line.includes("\n")) return new InvalidOverlayJsonRequestError();
    return parseLine(new TextEncoder().encode(line), validate);
  }

  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader
      .read()
      .catch((cause) => new OverlayJsonReadError({ cause }));
    if (next instanceof Error) {
      reader.releaseLock();
      return next;
    }
    if (next.done) {
      reader.releaseLock();
      return new InvalidOverlayJsonRequestError();
    }

    const end = next.value.indexOf(10);
    const part = end === -1 ? next.value : next.value.subarray(0, end);
    size += part.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      reader.releaseLock();
      return new OverlayJsonRequestTooLargeError();
    }
    chunks.push(part);
    if (end === -1) continue;

    reader.releaseLock();
    if (end !== next.value.byteLength - 1)
      return new InvalidOverlayJsonRequestError();
    const line = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      line.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return parseLine(line, validate);
  }
}

export function serializeOverlayJsonResponse<T>(
  result: T | Error,
  errorCode: OverlayJsonErrorCode = "OPERATION_FAILED"
): string {
  const error =
    result instanceof OverlayJsonRequestTooLargeError
      ? { code: "REQUEST_TOO_LARGE", message: "JSON request is too large" }
      : result instanceof InvalidOverlayJsonRequestError
        ? { code: "INVALID_REQUEST", message: "Invalid JSON request" }
        : result instanceof OverlayJsonReadError
          ? {
              code: "REQUEST_READ_FAILED",
              message: "Could not read JSON request",
            }
          : { code: errorCode, message: handledMessages[errorCode] };
  const envelope: OverlayCliResponse<T> =
    result instanceof Error ? { ok: false, error } : { ok: true, data: result };
  const serialized = errore.try(
    () => JSON.stringify(envelope),
    (cause) => new OverlayJsonReadError({ cause })
  );
  if (serialized instanceof Error || serialized === undefined)
    return '{"ok":false,"error":{"code":"OPERATION_FAILED","message":"Operation failed"}}\n';
  return `${serialized}\n`;
}
