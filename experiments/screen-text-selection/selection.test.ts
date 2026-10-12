import { expect, test } from "bun:test";
import vm from "node:vm";

type Word = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  symbols?: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};
type Boundary = { word: number; offset: number };
type Range = { start: Boundary; end: Boundary };
type Selection = {
  hit(words: Word[], x: number, y: number): number;
  textForRange(words: Word[], start: number, end: number): string;
  contains(index: number, start: number, end: number): boolean;
  rangeAt(
    words: Word[],
    anchor: { x: number; y: number },
    focus: { x: number; y: number },
    precise: boolean
  ): Range | null;
  moveHandle(
    words: Word[],
    range: Range,
    side: string,
    x: number,
    y: number
  ): Range | null;
  textForSelection(words: Word[], range: Range | null): string;
  highlightBoxes(words: Word[], range: Range | null): Word[];
  replacementText(
    words: Word[],
    range: Range | null,
    updated: Word[]
  ): string | null;
};

async function fullSelection(): Promise<Selection> {
  const source = await Bun.file(
    new URL("./full/selection.js", import.meta.url)
  ).text();
  return vm.runInNewContext(
    `${source}\n({ hit, textForRange, contains, rangeAt, moveHandle, textForSelection, highlightBoxes, replacementText })`
  ) as Selection;
}

function symbolWord(text: string, x: number, y = 10): Word {
  const symbols = Array.from(text).map((character, index) => ({
    text: character,
    x: x + index * 10,
    y,
    width: 10,
    height: 18,
  }));
  return { text, x, y, width: symbols.length * 10, height: 18, symbols };
}

for (const mode of ["full", "region"]) {
  test(`${mode} selects a wrapped sentence without replacing its other field`, async () => {
    const source = await Bun.file(
      new URL(`./${mode}/selection.js`, import.meta.url)
    ).text();
    const selection = vm.runInNewContext(
      `${source}\n({ hit, textForRange, contains })`
    ) as Selection;
    const words = [
      { text: "The", x: 10, y: 10, width: 32, height: 18 },
      { text: "fox", x: 52, y: 10, width: 34, height: 18 },
      { text: "jumps", x: 10, y: 42, width: 60, height: 18 },
      { text: "again.", x: 78, y: 42, width: 67, height: 18 },
      { text: "Sidebar", x: 280, y: 42, width: 70, height: 18 },
    ];

    const entryStart = selection.hit(words, 60, 20);
    const contextStart = selection.hit(words, 17, 19);
    const contextEnd = selection.hit(words, 140, 47);
    expect(entryStart).toBe(1);
    expect(selection.textForRange(words, entryStart, entryStart)).toBe("fox");
    expect(selection.textForRange(words, contextStart, contextEnd)).toBe(
      "The fox jumps again."
    );
    expect(selection.contains(4, contextStart, contextEnd)).toBe(false);
    expect(selection.hit(words, 190, 47)).toBe(-1);
  });
}

test("Ctrl drag selects a substring within a path-like word", async () => {
  const selection = await fullSelection();
  const words = [symbolWord("/tmp/żółw.txt", 10)];
  const range = selection.rangeAt(
    words,
    { x: 61, y: 19 },
    { x: 99, y: 19 },
    true
  );
  expect(selection.textForSelection(words, range)).toBe("żółw");
  expect(selection.highlightBoxes(words, range)).toHaveLength(4);
  const whole = selection.rangeAt(
    words,
    { x: 61, y: 19 },
    { x: 99, y: 19 },
    false
  );
  expect(selection.textForSelection(words, whole)).toBe("/tmp/żółw.txt");
  expect(selection.highlightBoxes(words, whole)).toHaveLength(1);
});

test("a handle can extend a selection beyond its original word and line", async () => {
  const selection = await fullSelection();
  const words = [
    symbolWord("one", 10),
    symbolWord("two", 60),
    symbolWord("three", 10, 42),
  ];
  const initial = selection.rangeAt(
    words,
    { x: 62, y: 19 },
    { x: 62, y: 19 },
    false
  );
  const extended = selection.moveHandle(words, initial!, "end", 59, 51);
  expect(selection.textForSelection(words, extended)).toBe("two three");
  const shrunk = selection.moveHandle(words, extended!, "start", 81, 19);
  expect(selection.textForSelection(words, shrunk)).toBe("o three");
});

test("missing or inconsistent symbols select the whole affected word", async () => {
  const selection = await fullSelection();
  const missing: Word = { text: "broken", x: 10, y: 10, width: 60, height: 18 };
  const inconsistent = symbolWord("next", 80);
  inconsistent.symbols![0].x = 200;
  const words = [missing, inconsistent, symbolWord("fine", 150)];
  const range = selection.rangeAt(
    words,
    { x: 30, y: 19 },
    { x: 169, y: 19 },
    true
  );
  expect(selection.textForSelection(words, range)).toBe("broken next fi");
  expect(selection.highlightBoxes(words, range)).toHaveLength(4);
});

test("a second pass changes text but leaves selected geometry untouched", async () => {
  const selection = await fullSelection();
  const first = [
    { text: "bad", x: 10, y: 10, width: 33, height: 18 },
    { text: "text", x: 49, y: 10, width: 40, height: 18 },
  ];
  const range = selection.rangeAt(
    first,
    { x: 15, y: 17 },
    { x: 60, y: 17 },
    false
  );
  const before = selection
    .highlightBoxes(first, range)
    .map((box) => ({ ...box }));
  const updated = [
    { text: "better", x: 11, y: 9, width: 34, height: 20 },
    { text: "text", x: 50, y: 9, width: 38, height: 20 },
    { text: "elsewhere", x: 210, y: 9, width: 90, height: 20 },
  ];

  expect(selection.replacementText(first, range, updated)).toBe("better text");
  expect(selection.highlightBoxes(first, range)).toEqual(before);
  expect(selection.replacementText(first, range, [updated[2]])).toBeNull();
});
