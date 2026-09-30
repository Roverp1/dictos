import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseTsv, recognize } from "./ocr";

test("recognizes words and line boundaries from Tesseract output", () => {
  const tsv = [
    "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
    "4\t1\t1\t1\t1\t0\t0\t0\t100\t20\t-1\t",
    "5\t1\t1\t1\t1\t1\t5\t10\t35\t16\t91\tQuick",
    "5\t1\t1\t1\t2\t1\t8\t35\t29\t14\t82\tfox.",
    "5\t1\t1\t1\t2\t2\t40\t35\t0\t14\t90\t",
  ].join("\n");

  expect(parseTsv(tsv)).toEqual([
    {
      text: "Quick",
      x: 5,
      y: 10,
      width: 35,
      height: 16,
      block: 1,
      line: "1:1:1",
      confidence: 91,
    },
    {
      text: "fox.",
      x: 8,
      y: 35,
      width: 29,
      height: 14,
      block: 1,
      line: "1:1:2",
      confidence: 82,
    },
  ]);
});

test("cropped OCR keeps words local to the padded region", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-ocr-test-")
  );
  try {
    const image = path.join(directory, "screenshot.png");
    const created = Bun.spawnSync(
      [
        "magick",
        "-size",
        "640x180",
        "xc:white",
        "-fill",
        "black",
        "-font",
        "DejaVu-Sans",
        "-pointsize",
        "30",
        "-annotate",
        "+24+56",
        "quick brown fox",
        "-annotate",
        "+24+138",
        "second quiet line",
        image,
      ],
      { stdout: "pipe", stderr: "pipe" }
    );
    if (!created.success) throw new Error("Could not create OCR test image");

    const full = recognize({ image, language: "eng", psm: 3 });
    if (full instanceof Error) throw full;
    const cropped = recognize({
      image,
      language: "eng",
      psm: 6,
      region: { x: 20, y: 26, width: 295, height: 40 },
    });
    if (cropped instanceof Error) throw cropped;

    expect(
      full.words.some((word) => word.text.toLowerCase() === "second")
    ).toBe(true);
    expect(cropped.words.map((word) => word.text.toLowerCase())).toContain(
      "quick"
    );
    expect(
      cropped.words.some((word) => word.text.toLowerCase() === "second")
    ).toBe(false);
    expect(cropped.region).toEqual({ x: 0, y: 6, width: 335, height: 80 });
    expect(
      cropped.words.some((word) =>
        full.words.some(
          (other) =>
            other.text.toLowerCase() === word.text.toLowerCase() &&
            Math.abs(other.x - (word.x + cropped.region!.x)) < 5
        )
      )
    ).toBe(true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
