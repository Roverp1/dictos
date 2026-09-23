import { afterEach, describe, expect, test } from "bun:test";
import type { NewEntry } from "@dictos/core";

import { createCliProgram } from "../app/program";
import type { CliContext, CliDependencies } from "../app/types";

const rootFolder = {
  id: "root-folder-id",
  name: "/",
  parentId: null,
  privacy: "private" as const,
  createdAt: new Date(0),
  modifiedAt: new Date(0),
};

function createContext() {
  const output: string[] = [];
  let createInput: NewEntry | null = null;
  let listedFolderId: string | null = null;

  const dependencies = {
    folderService: {
      async getRootFolder() {
        return rootFolder;
      },
    },
    entryService: {
      async createEntry(input: NewEntry) {
        createInput = input;
        return {
          id: "entry-id",
          ...input,
          createdAt: new Date(0),
          modifiedAt: new Date(0),
        };
      },
      async getEntriesInFolder(folderId: string) {
        listedFolderId = folderId;
        return [
          {
            id: "entry-id",
            folderId,
            text: "hello",
            createdAt: new Date(0),
            modifiedAt: new Date(0),
          },
        ];
      },
    },
  } as unknown as CliDependencies;

  const context: CliContext = {
    output: {
      writeData(text) {
        output.push(text);
      },
      writeError(text) {
        output.push(`error: ${text}`);
      },
    },
    terminalPrompt: {
      async readSecret() {
        return "";
      },
      async confirm() {
        return false;
      },
    },
    async getDependencies() {
      return dependencies;
    },
  };

  return {
    context,
    output,
    get createInput() {
      return createInput;
    },
    get listedFolderId() {
      return listedFolderId;
    },
  };
}

afterEach(() => {
  process.exitCode = 0;
});

describe("entry commands", () => {
  test("creates an Entry in the root Folder when --folder is omitted", async () => {
    const fixture = createContext();

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(["entry", "create", "--text", "hello"], { from: "user" });

    expect(fixture.createInput).toEqual({
      folderId: "root-folder-id",
      text: "hello",
    });
    expect(fixture.output).toEqual(["entry-id"]);
  });

  test("lists Entries in the root Folder when --folder is omitted", async () => {
    const fixture = createContext();

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(["entry", "list"], { from: "user" });

    expect(fixture.listedFolderId).toBe("root-folder-id");
    expect(fixture.output).toEqual(["entry-id\thello"]);
  });

  test("uses an explicitly selected Folder for Entry creation", async () => {
    const fixture = createContext();

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(
        [
          "entry",
          "create",
          "--folder",
          "selected-folder-id",
          "--text",
          "hello",
        ],
        { from: "user" }
      );

    expect(fixture.createInput).toEqual({
      folderId: "selected-folder-id",
      text: "hello",
    });
  });

  test("uses an explicitly selected Folder for Entry listing", async () => {
    const fixture = createContext();

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(["entry", "list", "--folder", "selected-folder-id"], {
        from: "user",
      });

    expect(fixture.listedFolderId).toBe("selected-folder-id");
  });
});
