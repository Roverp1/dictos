import { expect, test } from "bun:test";
import vm from "node:vm";

type Word = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type Selection = {
  hit(words: Word[], x: number, y: number): number;
  textForRange(words: Word[], start: number, end: number): string;
  contains(index: number, start: number, end: number): boolean;
};

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
