import fs from "node:fs";
import {
  overlayConfigurationSchema,
  validateConfigurationSnapshot,
} from "@dictos/config";
import * as errore from "@dictos/errore";

export class OcrStartupError extends errore.createTaggedError({
  name: "OcrStartupError",
  message:
    "Could not initialize OCR: no valid startup result. Check Tesseract language data in the overlay devenv shell.",
}) {}

class OcrInitializationError extends errore.createTaggedError({
  name: "OcrInitializationError",
  message: "$reason",
}) {}

export type OcrStartupRecord =
  | { ready: true; initMs: number }
  | {
      ready: false;
      error:
        | { code: "OCR_LANGUAGE_UNAVAILABLE"; missingLanguages: string[] }
        | { code: "OCR_INITIALIZATION_FAILED" | "OCR_STARTUP_FAILED" };
    };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: string[]) {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => key in value)
  );
}

export function decodeOcrStartupRecord({
  input,
  requestedLanguages,
}: {
  input: string | Uint8Array;
  requestedLanguages: readonly string[];
}): OcrStartupRecord | OcrStartupError {
  if (
    !overlayConfigurationSchema.safeParse({
      ocr: { languages: requestedLanguages },
    }).success
  )
    return new OcrStartupError();
  if (
    requestedLanguages.some((language) =>
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(language)
    )
  )
    return new OcrStartupError();
  if (Buffer.byteLength(input) > 16_384) return new OcrStartupError();
  const text = errore.try(
    () =>
      typeof input === "string"
        ? input
        : new TextDecoder("utf-8", { fatal: true }).decode(input),
    (cause) => new OcrStartupError({ cause })
  );
  if (text instanceof Error) return text;
  if (!text.endsWith("\n") || text.indexOf("\n") !== text.length - 1)
    return new OcrStartupError();
  const parsed = errore.try(
    () => ({ value: JSON.parse(text) as unknown }),
    (cause) => new OcrStartupError({ cause })
  );
  if (parsed instanceof Error) return parsed;
  const value = parsed.value;
  if (!object(value)) return new OcrStartupError();
  if (
    value.ready === true &&
    keys(value, ["ready", "initMs"]) &&
    typeof value.initMs === "number" &&
    Number.isFinite(value.initMs) &&
    value.initMs >= 0
  )
    return { ready: true, initMs: value.initMs };
  if (
    value.ready !== false ||
    !keys(value, ["ready", "error"]) ||
    !object(value.error)
  )
    return new OcrStartupError();
  const failure = value.error;
  if (
    (failure.code === "OCR_INITIALIZATION_FAILED" ||
      failure.code === "OCR_STARTUP_FAILED") &&
    keys(failure, ["code"])
  )
    return { ready: false, error: { code: failure.code } };
  if (
    failure.code !== "OCR_LANGUAGE_UNAVAILABLE" ||
    !keys(failure, ["code", "missingLanguages"]) ||
    !Array.isArray(failure.missingLanguages) ||
    failure.missingLanguages.length === 0
  )
    return new OcrStartupError();
  const missing = failure.missingLanguages;
  if (
    !missing.every(
      (item): item is string =>
        typeof item === "string" && requestedLanguages.includes(item)
    )
  )
    return new OcrStartupError();
  return {
    ready: false,
    error: { code: "OCR_LANGUAGE_UNAVAILABLE", missingLanguages: missing },
  };
}

export function renderOcrStartupFailure({
  record,
  requestedLanguages,
}: {
  record: OcrStartupRecord;
  requestedLanguages: readonly string[];
}) {
  if (record.ready) return "";
  const valid = decodeOcrStartupRecord({
    input: JSON.stringify(record) + "\n",
    requestedLanguages,
  });
  if (valid instanceof Error) return valid.message;
  if (record.error.code === "OCR_LANGUAGE_UNAVAILABLE")
    return `OCR language data unavailable: ${record.error.missingLanguages.join(", ")}. Install the requested Tesseract language data in the overlay devenv shell.`;
  return `Could not initialize OCR for requested languages: ${requestedLanguages.join(", ")}. Check Tesseract language data and the overlay devenv shell setup.`;
}

function snapshotLanguages() {
  const raw = process.env.DICTOS_OVERLAY_CONFIG_SNAPSHOT ?? "";
  if (Buffer.byteLength(raw) > 16_384) return new OcrStartupError();
  const parsed = errore.try(
    () => ({ value: JSON.parse(raw) as unknown }),
    (cause) => new OcrStartupError({ cause })
  );
  if (parsed instanceof Error) return parsed;
  const snapshot = validateConfigurationSnapshot({ value: parsed.value });
  if (snapshot instanceof Error)
    return new OcrStartupError({ cause: snapshot });
  if (snapshot.client !== "overlay" || snapshot.settings.ocrLanguages === null)
    return new OcrStartupError();
  if (
    snapshot.settings.ocrLanguages.some((language) =>
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(language)
    )
  )
    return new OcrStartupError();
  return snapshot.settings.ocrLanguages;
}

function main() {
  const requestedLanguages = snapshotLanguages();
  if (requestedLanguages instanceof Error) return requestedLanguages;
  if (process.argv[2] === "languages") {
    process.stdout.write(requestedLanguages.join("+"));
    return null;
  }
  // Read at most one bounded startup record, even if a helper writes indefinitely.
  const input = errore.try(
    () => {
      const fd = fs.openSync(process.argv[3] ?? "", "r");
      using cleanup = new errore.DisposableStack();
      cleanup.defer(() => fs.closeSync(fd));
      const bytes = Buffer.alloc(16_385);
      return bytes.subarray(0, fs.readSync(fd, bytes, 0, bytes.length, 0));
    },
    (cause) => new OcrStartupError({ cause })
  );
  if (input instanceof Error) return input;
  const record = decodeOcrStartupRecord({ input, requestedLanguages });
  if (record instanceof Error) return record;
  if (!record.ready)
    return new OcrInitializationError({
      reason: renderOcrStartupFailure({ record, requestedLanguages }),
    });
  return null;
}

if (import.meta.main) {
  const result = main();
  if (result instanceof Error) {
    process.stderr.write(result.message + "\n");
    process.exitCode = 1;
  }
}
