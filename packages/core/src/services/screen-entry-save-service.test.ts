import { describe, expect, test } from "bun:test";

import { DbError, ValidationError } from "../errors";
import type {
  ScreenEntrySaveInput,
  ScreenEntrySaveResult,
} from "../models/screen-entry-save";
import type { ScreenEntrySaveRepository } from "../ports/outbound/screen-entry-save-repository";
import {
  ScreenEntrySaveService,
  validateScreenEntrySaveInput,
} from "./screen-entry-save-service";

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
});

describe("ScreenEntrySaveService", () => {
  const saved: ScreenEntrySaveResult = {
    entry: {
      id: "entry-id",
      folderId: "root",
      text: "Entry",
      createdAt: new Date("2026-01-01"),
      modifiedAt: new Date("2026-01-01"),
    },
    sense: null,
    capturedDescription: null,
    descriptions: [],
  };

  test("center Save passes only reviewed Entry and captured Description to persistence", async () => {
    const committed: ScreenEntrySaveInput[] = [];
    const repository: ScreenEntrySaveRepository = {
      commit: async (input) => {
        committed.push(input);
        return saved;
      },
    };
    const result = await new ScreenEntrySaveService(repository).save({
      kind: "entry",
      folderId: "root",
      entryText: "Entry",
      descriptionText: " \n ",
    });

    expect(result).toEqual(saved);
    expect(committed[0]).toEqual({
      kind: "entry",
      folderId: "root",
      entryText: "Entry",
      descriptionText: null,
    });
  });

  test("inclusive right Save retains captured text and multiple Descriptions of one Type", async () => {
    const committed: ScreenEntrySaveInput[] = [];
    const repository: ScreenEntrySaveRepository = {
      commit: async (input) => {
        committed.push(input);
        return saved;
      },
    };
    const result = await new ScreenEntrySaveService(repository).save({
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

    expect(result).toEqual(saved);
    expect(committed[0]).toEqual({
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

  test("ordinary right Save excludes captured Description from persistence", async () => {
    const committed: ScreenEntrySaveInput[] = [];
    const repository: ScreenEntrySaveRepository = {
      commit: async (input) => {
        committed.push(input);
        return saved;
      },
    };
    const result = await new ScreenEntrySaveService(repository).save({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: "Captured",
      includeDescription: false,
      senseName: "Sense",
      descriptions: [{ type: "definition", text: " Defined " }],
    });

    expect(result).toEqual(saved);
    expect(committed[0]).toEqual({
      kind: "sense",
      folderId: "root",
      entryText: "Entry",
      descriptionText: null,
      includeDescription: false,
      senseName: "Sense",
      descriptions: [{ type: "definition", text: " Defined " }],
    });
  });

  test("returns validation failures without persisting", async () => {
    const repository: ScreenEntrySaveRepository = {
      commit: async () =>
        new DbError({ operation: "commit", reason: "unexpected" }),
    };
    const result = await new ScreenEntrySaveService(repository).save({
      kind: "entry",
      folderId: "root",
      entryText: " \t",
      descriptionText: null,
    });

    expect(result).toBeInstanceOf(ValidationError);
  });

  test("returns persistence failures as values", async () => {
    const failure = new DbError({ operation: "commit", reason: "failed" });
    const repository: ScreenEntrySaveRepository = {
      commit: async () => failure,
    };
    const result = await new ScreenEntrySaveService(repository).save({
      kind: "entry",
      folderId: "root",
      entryText: "Entry",
      descriptionText: null,
    });

    expect(result).toBe(failure);
  });
});
