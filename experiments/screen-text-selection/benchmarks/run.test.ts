import { expect, test } from "bun:test";
import { parseArgs, summarizeResponse } from "./run.ts";

test("rejects unsafe IDs and outputs outside the repository", () => {
  const args = [
    "--image",
    "tmp/screeshoots/500-words.png",
    "--sample-id",
    "dense",
    "--engine",
    "cli",
    "--language",
    "eng",
    "--psm",
    "3",
    "--repeat",
    "2",
  ];
  expect(parseArgs([...args, "--output", "/tmp/results.jsonl"])).toBeInstanceOf(
    Error
  );
  expect(parseArgs([...args, "--sample-id", "private/path"])).toBeInstanceOf(
    Error
  );
  expect(parseArgs(args)).not.toBeInstanceOf(Error);
});

test("only numeric summaries escape the OCR response", () => {
  const summary = summarizeResponse(
    JSON.stringify({
      words: [{ text: "private transcript", symbols: [{ text: "secret" }] }],
      elapsedMs: 42.5,
      width: 100,
      height: 80,
      symbolCount: 3,
      image: "/private/image.png",
      stderr: "private failure",
    }),
    "native"
  );
  if (summary instanceof Error) throw summary;
  expect(summary).toEqual({
    wordCount: 1,
    symbolCount: 3,
    engineElapsedMs: 42.5,
    dimensions: { width: 100, height: 80 },
  });
  expect(JSON.stringify(summary)).not.toMatch(/private|secret/);
});

test("engine errors do not include returned text", () => {
  const result = summarizeResponse(
    '{"error":"private failure","words":[]}',
    "cli"
  );
  expect(result).toBeInstanceOf(Error);
  expect(JSON.stringify(result)).not.toContain("private");
});
