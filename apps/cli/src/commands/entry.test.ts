import { afterEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BunTursoClient } from "@dictos/bun-turso-sync";
import { EntryService, FolderService } from "@dictos/core";
import { SqliteEntryRepository, SqliteFolderRepository } from "@dictos/db-core";
import type { Logger } from "@dictos/logger";

import { createCliProgram } from "../app/program";
import type { CliContext, CliDependencies } from "../app/types";

const testLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => testLogger,
};

async function createFixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-cli-entry-")
  );
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    testLogger
  );
  const folderService = new FolderService(
    new SqliteFolderRepository(client.db)
  );
  const entryService = new EntryService(
    new SqliteEntryRepository(client.db, crypto.randomUUID())
  );
  const output: string[] = [];
  const dependencies = {
    folderService,
    entryService,
  } as CliDependencies;
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
    entryService,
    folderService,
    output,
    async cleanup() {
      const closed = await client.close();
      if (closed instanceof Error) throw closed;
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}

afterEach(() => {
  process.exitCode = 0;
});

describe("entry commands", () => {
  test("creates an Entry in the root Folder when --folder is omitted", async () => {
    const fixture = await createFixture();

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(["entry", "create", "--text", "hello"], { from: "user" });

    const root = await fixture.folderService.getRootFolder();
    if (root instanceof Error) throw root;
    const entries = await fixture.entryService.getEntriesInFolder(root.id);
    if (entries instanceof Error) throw entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ folderId: root.id, text: "hello" });
    expect(fixture.output).toEqual([entries[0]!.id]);

    await fixture.cleanup();
  });

  test("lists Entries in the root Folder when --folder is omitted", async () => {
    const fixture = await createFixture();
    const root = await fixture.folderService.getRootFolder();
    if (root instanceof Error) throw root;
    const entry = await fixture.entryService.createEntry({
      folderId: root.id,
      text: "hello",
    });
    if (entry instanceof Error) throw entry;

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(["entry", "list"], { from: "user" });

    expect(fixture.output).toEqual([`${entry.id}\thello`]);

    await fixture.cleanup();
  });

  test("uses an explicitly selected Folder for Entry creation", async () => {
    const fixture = await createFixture();
    const root = await fixture.folderService.getRootFolder();
    if (root instanceof Error) throw root;
    const selectedFolder = await fixture.folderService.createFolder({
      name: "selected",
      parentId: root.id,
    });
    if (selectedFolder instanceof Error) throw selectedFolder;

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(
        ["entry", "create", "--folder", selectedFolder.id, "--text", "hello"],
        { from: "user" }
      );

    const entries = await fixture.entryService.getEntriesInFolder(
      selectedFolder.id
    );
    if (entries instanceof Error) throw entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      folderId: selectedFolder.id,
      text: "hello",
    });

    await fixture.cleanup();
  });

  test("uses an explicitly selected Folder for Entry listing", async () => {
    const fixture = await createFixture();
    const root = await fixture.folderService.getRootFolder();
    if (root instanceof Error) throw root;
    const selectedFolder = await fixture.folderService.createFolder({
      name: "selected",
      parentId: root.id,
    });
    if (selectedFolder instanceof Error) throw selectedFolder;
    const entry = await fixture.entryService.createEntry({
      folderId: selectedFolder.id,
      text: "hello",
    });
    if (entry instanceof Error) throw entry;

    await createCliProgram(fixture.context)
      .exitOverride()
      .parseAsync(["entry", "list", "--folder", selectedFolder.id], {
        from: "user",
      });

    expect(fixture.output).toEqual([`${entry.id}\thello`]);

    await fixture.cleanup();
  });
});
