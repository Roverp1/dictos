import * as errore from "../../packages/errore/src/index.ts";

export type OcrWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  block: number;
  line: string;
  confidence: number;
};

type Region = { x: number; y: number; width: number; height: number };

class OcrError extends errore.createTaggedError({
  name: "OcrError",
  message: "$reason",
}) {}

export function parseTsv(tsv: string): OcrWord[] {
  return tsv
    .split(/\r?\n/)
    .slice(1)
    .flatMap((row) => {
      const columns = row.split("\t");
      if (columns.length < 12 || columns[0] !== "5") return [];

      const [block, paragraph, line, x, y, width, height, confidence] = [
        2, 3, 4, 6, 7, 8, 9, 10,
      ].map((index) => Number(columns[index]));
      const text = columns.slice(11).join("\t").trim();
      if (
        !text ||
        ![block, paragraph, line, x, y, width, height, confidence].every(
          Number.isFinite
        ) ||
        confidence < 0 ||
        width <= 0 ||
        height <= 0
      )
        return [];

      return [
        {
          text,
          x,
          y,
          width,
          height,
          block,
          line: `${block}:${paragraph}:${line}`,
          confidence,
        },
      ];
    });
}

function run(command: string[]) {
  const result = errore.try(
    () => Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" }),
    (cause) => new OcrError({ reason: `Could not start ${command[0]}.`, cause })
  );
  if (result instanceof Error) return result;
  if (!result.success)
    return new OcrError({
      reason: `${command[0]} failed (exit ${result.exitCode}).`,
    });
  return result.stdout;
}

function imageDimensions(path: string) {
  const output = run(["magick", "identify", "-format", "%w %h", path]);
  if (output instanceof Error) return output;
  const [width, height] = output.toString().trim().split(/\s+/).map(Number);
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  )
    return new OcrError({ reason: "Could not read screenshot dimensions." });
  return { width, height };
}

function paddedRegion(
  region: Region,
  bounds: { width: number; height: number }
) {
  if (
    !Object.values(region).every(Number.isSafeInteger) ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x < 0 ||
    region.y < 0 ||
    region.x >= bounds.width ||
    region.y >= bounds.height
  )
    return new OcrError({ reason: "Invalid OCR region." });

  const margin = 20;
  const x = Math.max(0, region.x - margin);
  const y = Math.max(0, region.y - margin);
  const right = Math.min(bounds.width, region.x + region.width + margin);
  const bottom = Math.min(bounds.height, region.y + region.height + margin);
  return { x, y, width: right - x, height: bottom - y };
}

export function recognize(input: {
  image: string;
  language: string;
  psm: number;
  region?: Region;
}) {
  const started = performance.now();
  const dimensions = imageDimensions(input.image);
  if (dimensions instanceof Error) return dimensions;
  const region = input.region ? paddedRegion(input.region, dimensions) : null;
  if (region instanceof Error) return region;

  const image = region
    ? run([
        "magick",
        input.image,
        "-crop",
        `${region.width}x${region.height}+${region.x}+${region.y}`,
        "+repage",
        "png:-",
      ])
    : null;
  if (image instanceof Error) return image;

  const result = errore.try(
    () =>
      Bun.spawnSync(
        [
          "tesseract",
          region ? "stdin" : input.image,
          "stdout",
          "-l",
          input.language,
          "--psm",
          String(input.psm),
          "tsv",
        ],
        {
          ...(image ? { stdin: image } : {}),
          stdout: "pipe",
          stderr: "pipe",
        }
      ),
    (cause) => new OcrError({ reason: "Could not start Tesseract.", cause })
  );
  if (result instanceof Error) return result;
  if (!result.success)
    return new OcrError({
      reason: `Tesseract failed (exit ${result.exitCode}).`,
    });

  return {
    words: parseTsv(result.stdout.toString()),
    elapsedMs: Math.round(performance.now() - started),
    region,
  };
}

if (import.meta.main) {
  const [image, language, psmText, ...coordinates] = process.argv.slice(2);
  const psm = Number(psmText);
  const validCoordinates = coordinates.length === 0 || coordinates.length === 4;
  const region =
    coordinates.length === 4
      ? {
          x: Number(coordinates[0]),
          y: Number(coordinates[1]),
          width: Number(coordinates[2]),
          height: Number(coordinates[3]),
        }
      : undefined;
  const result =
    image && language && validCoordinates && [3, 6, 11].includes(psm)
      ? recognize({ image, language, psm, region })
      : new OcrError({
          reason: "Usage: ocr.ts IMAGE LANG PSM [X Y WIDTH HEIGHT]",
        });

  process.stdout.write(
    `${JSON.stringify(result instanceof Error ? { error: result.message, words: [] } : result)}\n`
  );
  if (result instanceof Error) process.exitCode = 1;
}
