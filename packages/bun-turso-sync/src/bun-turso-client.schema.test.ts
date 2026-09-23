import { afterEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DbError } from "@dictos/core";
import {
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteInstructionRepository,
  SqliteSenseRepository,
} from "@dictos/db-core";
import type { Logger } from "@dictos/logger";
import { sql } from "drizzle-orm";

import { BunTursoClient } from "./bun-turso-client";

const testLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => testLogger,
};

const cleanups = new Set<() => Promise<void>>();

async function createFixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-fresh-schema-")
  );
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    testLogger
  );
  const folders = new SqliteFolderRepository(client.db);
  const root = await folders.findRoot();
  if (root instanceof Error) throw root;
  cleanups.add(async () => {
    const closed = await client.close();
    if (closed instanceof Error) throw closed;
    await fs.rm(directory, { recursive: true, force: true });
  });

  return {
    client,
    descriptions: new SqliteDescriptionRepository(client.db),
    entries: new SqliteEntryRepository(client.db, crypto.randomUUID()),
    folders,
    instructions: new SqliteInstructionRepository(client.db),
    root,
    senses: new SqliteSenseRepository(client.db),
  };
}

afterEach(async () => {
  const pendingCleanups = [...cleanups];
  cleanups.clear();
  for (const cleanup of pendingCleanups) await cleanup();
});

describe("fresh Bun database migration", () => {
  test("creates the planned tables, indexes, and checks", async () => {
    const fixture = await createFixture();
    const schemaObjects = await fixture.client.db.values<
      ["index" | "table" | "trigger", string]
    >(
      sql.raw(`
        SELECT type, name
        FROM sqlite_schema
        WHERE name NOT LIKE 'sqlite_%'
        ORDER BY type, name
      `)
    );
    const tables = schemaObjects
      .filter(([type]) => type === "table")
      .map(([, name]) => name);
    const indexes = schemaObjects
      .filter(([type]) => type === "index")
      .map(([, name]) => name);

    expect(tables).toEqual(
      expect.arrayContaining([
        "activities",
        "descriptions",
        "entries",
        "folders",
        "instructions",
        "outbox",
        "senses",
        "users",
      ])
    );
    expect(indexes).toEqual([
      "descriptions_entry_id_idx",
      "descriptions_sense_id_idx",
      "senses_entry_id_idx",
    ]);

    const entry = await fixture.entries.save({
      folderId: fixture.root.id,
      text: "schema checks",
    });
    if (entry instanceof Error) throw entry;
    const invalidDescription = await fixture.descriptions.save({
      entryId: entry.id,
      text: "invalid type",
      type: "invalid" as never,
    });
    const invalidFolder = await fixture.folders.save({
      name: "invalid privacy",
      parentId: fixture.root.id,
      privacy: "invalid" as never,
    });

    expect(invalidDescription).toBeInstanceOf(DbError);
    expect(invalidFolder).toBeInstanceOf(DbError);
  });

  test("creates and enables the planned foreign keys", async () => {
    const fixture = await createFixture();
    const foreignKeysEnabled = await fixture.client.db.values<[number]>(
      sql.raw("PRAGMA foreign_keys")
    );
    const descriptionForeignKeys = await fixture.client.db.values<
      [number, number, string, string, string, string, string, string]
    >(sql.raw("PRAGMA foreign_key_list(descriptions)"));
    const senseForeignKeys = await fixture.client.db.values<
      [number, number, string, string, string, string, string, string]
    >(sql.raw("PRAGMA foreign_key_list(senses)"));
    const entryForeignKeys = await fixture.client.db.values<
      [number, number, string, string, string, string, string, string]
    >(sql.raw("PRAGMA foreign_key_list(entries)"));

    expect(foreignKeysEnabled).toEqual([[1]]);
    expect(descriptionForeignKeys).toEqual(
      expect.arrayContaining([
        [0, 0, "senses", "sense_id", "id", "NO ACTION", "SET NULL", "NONE"],
        [1, 0, "entries", "entry_id", "id", "NO ACTION", "CASCADE", "NONE"],
      ])
    );
    expect(senseForeignKeys).toEqual([
      [0, 0, "entries", "entry_id", "id", "NO ACTION", "CASCADE", "NONE"],
    ]);
    expect(entryForeignKeys).toEqual([
      [0, 0, "folders", "folder_id", "id", "NO ACTION", "CASCADE", "NONE"],
    ]);
  });

  test("installs working lifecycle triggers", async () => {
    const fixture = await createFixture();
    const triggerRows = await fixture.client.db.values<[string]>(
      sql.raw(`
        SELECT name
        FROM sqlite_schema
        WHERE type = 'trigger'
        ORDER BY name
      `)
    );
    expect(triggerRows.map(([name]) => name)).toEqual([
      "set_descriptions_modified_at",
      "set_entries_modified_at",
      "set_folders_modified_at",
      "set_instructions_modified_at",
      "set_senses_modified_at",
      "update_folder_on_entry_delete",
      "update_folder_on_entry_insert",
      "update_folder_on_entry_update",
    ]);

    const childFolder = await fixture.folders.save({
      name: "child",
      parentId: fixture.root.id,
    });
    if (childFolder instanceof Error) throw childFolder;
    const entry = await fixture.entries.save({
      folderId: fixture.root.id,
      text: "before",
    });
    if (entry instanceof Error) throw entry;
    const description = await fixture.descriptions.save({
      entryId: entry.id,
      text: "before",
    });
    if (description instanceof Error) throw description;
    const sense = await fixture.senses.save({
      entryId: entry.id,
      name: "before",
    });
    if (sense instanceof Error) throw sense;
    const instruction = await fixture.instructions.save({ text: "before" });
    if (instruction instanceof Error) throw instruction;
    const rootBeforeInsert = await fixture.folders.findRoot();
    if (rootBeforeInsert instanceof Error) throw rootBeforeInsert;

    await Bun.sleep(1_100);

    const folderUpdate = await fixture.folders.update(childFolder.id, {
      name: "after",
    });
    if (folderUpdate instanceof Error) throw folderUpdate;
    const entryUpdate = await fixture.entries.update(entry.id, {
      text: "after",
    });
    if (entryUpdate instanceof Error) throw entryUpdate;
    const descriptionUpdate = await fixture.descriptions.update(
      description.id,
      {
        text: "after",
      }
    );
    if (descriptionUpdate instanceof Error) throw descriptionUpdate;
    const senseUpdate = await fixture.senses.update(sense.id, {
      name: "after",
    });
    if (senseUpdate instanceof Error) throw senseUpdate;
    const instructionUpdate = await fixture.instructions.update(
      instruction.id,
      {
        text: "after",
      }
    );
    if (instructionUpdate instanceof Error) throw instructionUpdate;
    const insertedEntry = await fixture.entries.save({
      folderId: fixture.root.id,
      text: "folder trigger",
    });
    if (insertedEntry instanceof Error) throw insertedEntry;

    const updatedFolder = await fixture.folders.findById(childFolder.id);
    if (updatedFolder instanceof Error) throw updatedFolder;
    if (updatedFolder === null) throw new Error("Updated Folder not found");
    const updatedEntry = await fixture.entries.findById(entry.id);
    if (updatedEntry instanceof Error) throw updatedEntry;
    if (updatedEntry === null) throw new Error("Updated Entry not found");
    const updatedDescription = await fixture.descriptions.findById(
      description.id
    );
    if (updatedDescription instanceof Error) throw updatedDescription;
    if (updatedDescription === null)
      throw new Error("Updated Description not found");
    const updatedSense = await fixture.senses.findById(sense.id);
    if (updatedSense instanceof Error) throw updatedSense;
    if (updatedSense === null) throw new Error("Updated Sense not found");
    const updatedInstruction = await fixture.instructions.findById(
      instruction.id
    );
    if (updatedInstruction instanceof Error) throw updatedInstruction;
    if (updatedInstruction === null)
      throw new Error("Updated Instruction not found");
    const rootAfterInsert = await fixture.folders.findRoot();
    if (rootAfterInsert instanceof Error) throw rootAfterInsert;

    expect(updatedFolder.modifiedAt.getTime()).toBeGreaterThan(
      childFolder.modifiedAt.getTime()
    );
    expect(updatedEntry.modifiedAt.getTime()).toBeGreaterThan(
      entry.modifiedAt.getTime()
    );
    expect(updatedDescription.modifiedAt.getTime()).toBeGreaterThan(
      description.modifiedAt.getTime()
    );
    expect(updatedSense.modifiedAt.getTime()).toBeGreaterThan(
      sense.modifiedAt.getTime()
    );
    expect(updatedInstruction.modifiedAt.getTime()).toBeGreaterThan(
      instruction.modifiedAt.getTime()
    );
    expect(rootAfterInsert.modifiedAt.getTime()).toBeGreaterThan(
      rootBeforeInsert.modifiedAt.getTime()
    );
  });
});
