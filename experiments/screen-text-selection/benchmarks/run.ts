import * as errore from "../../../packages/errore/src/index.ts";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dir, "../../..");
const cli = path.resolve(import.meta.dir, "../ocr.ts");
const native = path.resolve(import.meta.dir, "../symbols/ocr-symbols");
const defaultOutput = path.resolve(import.meta.dir, "results.jsonl");

class BenchmarkError extends errore.createTaggedError({
  name: "BenchmarkError",
  message: "$reason",
}) {}

type Options = {
  image: string;
  sampleId: string;
  engine: "cli" | "native";
  language: string;
  psm: number;
  repeat: number;
  ompThreadLimit: number | null;
  modelLabel: string | null;
  output: string;
};

export function parseArgs(args: string[]) {
  const keys = new Set([
    "image",
    "sample-id",
    "engine",
    "language",
    "psm",
    "repeat",
    "omp-thread-limit",
    "model-label",
    "output",
  ]);
  const pairs: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    if (
      !key ||
      !args[i]?.startsWith("--") ||
      !keys.has(key) ||
      !args[i + 1] ||
      key in pairs
    )
      return new BenchmarkError({
        reason: "Invalid or duplicate argument. See benchmarks/README.md.",
      });
    pairs[key] = args[i + 1];
  }
  const safe = /^[a-zA-Z0-9][a-zA-Z0-9_.+-]{0,63}$/;
  const id = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
  if (
    !pairs.image ||
    !id.test(pairs["sample-id"] ?? "") ||
    !["cli", "native"].includes(pairs.engine) ||
    !safe.test(pairs.language ?? "") ||
    ![3, 6, 11].includes(Number(pairs.psm)) ||
    !/^[1-9]\d*$/.test(pairs.repeat ?? "") ||
    Number(pairs.repeat) > 100 ||
    (pairs["omp-thread-limit"] !== undefined &&
      (!/^[1-9]\d*$/.test(pairs["omp-thread-limit"]) ||
        Number(pairs["omp-thread-limit"]) > 256)) ||
    (pairs["model-label"] !== undefined && !safe.test(pairs["model-label"]))
  )
    return new BenchmarkError({
      reason: "Invalid benchmark configuration. See benchmarks/README.md.",
    });

  const output = path.resolve(repo, pairs.output ?? defaultOutput);
  if (
    !output.startsWith(`${repo}${path.sep}`) ||
    path.extname(output) !== ".jsonl"
  )
    return new BenchmarkError({
      reason: "Output must be a .jsonl file inside the repository.",
    });
  return {
    image: pairs.image,
    sampleId: pairs["sample-id"],
    engine: pairs.engine as Options["engine"],
    language: pairs.language,
    psm: Number(pairs.psm),
    repeat: Number(pairs.repeat),
    ompThreadLimit: pairs["omp-thread-limit"]
      ? Number(pairs["omp-thread-limit"])
      : null,
    modelLabel: pairs["model-label"] ?? null,
    output,
  } satisfies Options;
}

function positiveDimension(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Select known numeric fields only. OCR output and error strings never reach the record.
export function summarizeResponse(raw: string, engine: Options["engine"]) {
  const parsed = errore.try(
    () => JSON.parse(raw) as unknown,
    (cause) => new BenchmarkError({ reason: "invalid-json", cause })
  );
  if (parsed instanceof Error) return parsed;
  if (typeof parsed !== "object" || parsed === null)
    return new BenchmarkError({ reason: "invalid-response" });
  const result = parsed as Record<string, unknown>;
  if (typeof result.error === "string")
    return new BenchmarkError({ reason: "engine-error" });
  if (
    !Array.isArray(result.words) ||
    !result.words.every(
      (word: unknown) =>
        typeof word === "object" &&
        word !== null &&
        typeof (word as Record<string, unknown>).text === "string"
    )
  )
    return new BenchmarkError({ reason: "invalid-response" });
  if (!nonnegative(result.elapsedMs))
    return new BenchmarkError({ reason: "invalid-response" });
  if (
    engine === "native" &&
    (!positiveDimension(result.width) ||
      !positiveDimension(result.height) ||
      !Number.isSafeInteger(result.symbolCount) ||
      (result.symbolCount as number) < 0)
  )
    return new BenchmarkError({ reason: "invalid-response" });
  return {
    wordCount: result.words.length,
    symbolCount: engine === "native" ? (result.symbolCount as number) : null,
    engineElapsedMs: result.elapsedMs as number,
    dimensions:
      engine === "native"
        ? { width: result.width as number, height: result.height as number }
        : null,
  };
}

function command(args: string[], env = process.env) {
  return errore.try(
    () => Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe", env }),
    (cause) => new BenchmarkError({ reason: "spawn-failed", cause })
  );
}

async function imageMetadata(image: string) {
  const bytes = await fs
    .readFile(image)
    .catch(
      (cause) => new BenchmarkError({ reason: "image-unreadable", cause })
    );
  if (bytes instanceof Error) return bytes;
  const identified = command(["magick", "identify", "-format", "%w %h", image]);
  if (identified instanceof Error || !identified.success)
    return new BenchmarkError({ reason: "dimensions-unavailable" });
  const [width, height] = identified.stdout
    .toString()
    .trim()
    .split(/\s+/)
    .map(Number);
  if (!positiveDimension(width) || !positiveDimension(height))
    return new BenchmarkError({ reason: "dimensions-unavailable" });
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    dimensions: { width, height },
  };
}

async function outputPath(output: string) {
  const parent = await fs
    .realpath(path.dirname(output))
    .catch(
      (cause) =>
        new BenchmarkError({ reason: "output-directory-unavailable", cause })
    );
  if (parent instanceof Error) return parent;
  if (!parent.startsWith(`${repo}${path.sep}`))
    return new BenchmarkError({
      reason: "Output directory must stay inside the repository.",
    });
  const existing = await fs
    .lstat(output)
    .catch((cause: NodeJS.ErrnoException) =>
      cause.code === "ENOENT"
        ? null
        : new BenchmarkError({ reason: "output-unavailable", cause })
    );
  if (existing instanceof Error) return existing;
  if (existing && !existing.isFile())
    return new BenchmarkError({ reason: "Output must be a regular file." });
  return output;
}

export async function run(options: Options) {
  const output = await outputPath(options.output);
  if (output instanceof Error) return output;
  const metadata = await imageMetadata(options.image);
  if (metadata instanceof Error) return metadata;

  for (let repetition = 1; repetition <= options.repeat; repetition++) {
    const timestamp = new Date().toISOString();
    const started = performance.now();
    const args =
      options.engine === "cli"
        ? ["bun", cli, options.image, options.language, String(options.psm)]
        : [native, options.image, options.language, String(options.psm)];
    const processResult = command(args, {
      ...process.env,
      ...(options.ompThreadLimit === null
        ? {}
        : { OMP_THREAD_LIMIT: String(options.ompThreadLimit) }),
    });
    const wallElapsedMs = Math.round((performance.now() - started) * 100) / 100;
    const response =
      processResult instanceof Error || !processResult.success
        ? new BenchmarkError({
            reason:
              processResult instanceof Error ? "spawn-failed" : "nonzero-exit",
          })
        : summarizeResponse(processResult.stdout.toString(), options.engine);
    const result =
      response instanceof Error
        ? response
        : response.dimensions &&
            (response.dimensions.width !== metadata.dimensions.width ||
              response.dimensions.height !== metadata.dimensions.height)
          ? new BenchmarkError({ reason: "dimensions-mismatch" })
          : response;
    const record = {
      schemaVersion: 1,
      timestamp,
      sampleId: options.sampleId,
      imageSha256: metadata.sha256,
      dimensions: metadata.dimensions,
      engine: options.engine,
      language: options.language,
      psm: options.psm,
      ompThreadLimit: options.ompThreadLimit,
      modelLabel: options.modelLabel,
      repetition,
      processStart: "fresh",
      warmState: null,
      wallElapsedMs,
      engineElapsedMs: result instanceof Error ? null : result.engineElapsedMs,
      wordCount: result instanceof Error ? null : result.wordCount,
      symbolCount: result instanceof Error ? null : result.symbolCount,
      exitCode: processResult instanceof Error ? null : processResult.exitCode,
      status: result instanceof Error ? "failed" : "ok",
      failureKind:
        result instanceof BenchmarkError
          ? result.reason
          : result instanceof Error
            ? "unknown-error"
            : null,
    };
    const written = await fs
      .appendFile(output, `${JSON.stringify(record)}\n`, { flag: "a" })
      .catch((cause) => new BenchmarkError({ reason: "write-failed", cause }));
    if (written instanceof Error) return written;
    console.log(JSON.stringify(record));
  }
  return null;
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2));
  const result = options instanceof Error ? options : await run(options);
  if (result instanceof Error) {
    console.error(`Benchmark failed: ${result.reason}`);
    process.exitCode = 1;
  }
}
