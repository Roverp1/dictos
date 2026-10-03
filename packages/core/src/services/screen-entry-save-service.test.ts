import { describe, expect, test } from "bun:test";

import { ValidationError } from "../errors";
import { validateScreenEntrySaveInput } from "./screen-entry-save-service";

describe("validateScreenEntrySaveInput", () => {
  test("rejects an all-whitespace Entry", () => {
    const result = validateScreenEntrySaveInput({
      kind: "entry",
      folderId: "root",
      entryText: " \n\t ",
      descriptionText: null,
    });

    expect(result).toBeInstanceOf(ValidationError);
  });

  test("rejects an absent root Folder ID", () => {
    const result = validateScreenEntrySaveInput({
      kind: "entry",
      folderId: " \t ",
      entryText: "Entry",
      descriptionText: null,
    });

    expect(result).toBeInstanceOf(ValidationError);
  });

  test("rejects a blank Sense on right Save", () => {
    const result = validateScreenEntrySaveInput({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: null,
      includeDescription: false,
      senseName: " \n ",
      descriptions: [{ type: "definition", text: "Defined" }],
    });

    expect(result).toBeInstanceOf(ValidationError);
  });

  test("rejects an invalid Description Type even when its text is blank", () => {
    const result = validateScreenEntrySaveInput({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: null,
      includeDescription: false,
      senseName: "Sense",
      descriptions: [
        { type: "definition", text: "Defined" },
        { type: "wrong" as "misc", text: "  " },
      ],
    });

    expect(result).toBeInstanceOf(ValidationError);
  });

  test("requires a nonempty typed Description on right Save", () => {
    const result = validateScreenEntrySaveInput({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: "Captured",
      includeDescription: true,
      senseName: "Sense",
      descriptions: [{ type: "example", text: " \n " }],
    });

    expect(result).toBeInstanceOf(ValidationError);
  });

  test("center Save omits blank captured Description and preserves Entry text", () => {
    const result = validateScreenEntrySaveInput({
      kind: "entry",
      folderId: "root",
      entryText: "  Entry \n",
      descriptionText: " \t ",
    });

    expect(result).toEqual({
      kind: "entry",
      folderId: "root",
      entryText: "  Entry \n",
      descriptionText: null,
    });
  });

  test("center Save keeps nonempty captured Description text exactly", () => {
    const input = {
      kind: "entry" as const,
      folderId: "root",
      entryText: "Entry",
      descriptionText: "  Captured \n",
    };

    expect(validateScreenEntrySaveInput(input)).toEqual(input);
  });

  test("ordinary right Save ignores captured text and omits blank typed editors", () => {
    const result = validateScreenEntrySaveInput({
      kind: "sense",
      folderId: "root",
      entryText: "  Entry ",
      descriptionText: " Captured ",
      includeDescription: false,
      senseName: " Sense ",
      descriptions: [
        { type: "translation", text: " Tłumaczenie \n" },
        { type: "translation", text: " \n" },
        { type: "translation", text: " Drugie " },
      ],
    });

    expect(result).toEqual({
      kind: "sense",
      folderId: "root",
      entryText: "  Entry ",
      descriptionText: null,
      includeDescription: false,
      senseName: " Sense ",
      descriptions: [
        { type: "translation", text: " Tłumaczenie \n" },
        { type: "translation", text: " Drugie " },
      ],
    });
  });

  test("inclusive right Save omits blank captured text", () => {
    const result = validateScreenEntrySaveInput({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: " \n ",
      includeDescription: true,
      senseName: "Sense",
      descriptions: [{ type: "misc", text: "Typed" }],
    });

    expect(result).toEqual({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: null,
      includeDescription: true,
      senseName: "Sense",
      descriptions: [{ type: "misc", text: "Typed" }],
    });
  });
  test("inclusive right Save preserves reviewed text and multiple Descriptions of one Type", () => {
    const result = validateScreenEntrySaveInput({
      kind: "sense",
      folderId: "root",
      entryText: "  Entry ",
      descriptionText: " Captured \n",
      includeDescription: true,
      senseName: " Sense ",
      descriptions: [
        { type: "example", text: " Example one " },
        { type: "example", text: "\t" },
        { type: "example", text: " Example two\n" },
      ],
    });

    expect(result).toEqual({
      kind: "sense",
      folderId: "root",
      entryText: "  Entry ",
      descriptionText: " Captured \n",
      includeDescription: true,
      senseName: " Sense ",
      descriptions: [
        { type: "example", text: " Example one " },
        { type: "example", text: " Example two\n" },
      ],
    });
  });
});
