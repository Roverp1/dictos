import { afterEach, expect, test } from "vitest";
import { sql } from "drizzle-orm";

import { DbError } from "@dictos/core";
import {
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteInstructionRepository,
  SqliteSenseRepository,
} from "@dictos/db-core";
import type { Logger } from "@dictos/logger";

import journal from "../../db-core/migrations/meta/_journal.json";
import type { Journal } from "./migrator";
import { WasmTursoClient } from "./wasm-turso-client";

const sqlFiles = import.meta.glob("../../db-core/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

const testLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => testLogger,
};

let client: WasmTursoClient | null = null;

afterEach(async () => {
  if (client === null) return;
  const closed = await client.close();
  client = null;
  if (closed instanceof Error) throw closed;
});

test("applies the baseline schema and lifecycle behavior to fresh OPFS", async () => {
  client = await WasmTursoClient.create(
    `dictos-wasm-test-${crypto.randomUUID()}.db`,
    testLogger,
    { journal: journal as Journal, sqlFiles }
  );
  const folders = new SqliteFolderRepository(client.db);
  const entries = new SqliteEntryRepository(client.db, crypto.randomUUID());
  const descriptions = new SqliteDescriptionRepository(client.db);
  const senses = new SqliteSenseRepository(client.db);
  const instructions = new SqliteInstructionRepository(client.db);
  const root = await folders.findRoot();
  if (root instanceof Error) throw root;

  const schemaObjects = await client.db.values<
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
  const triggers = schemaObjects
    .filter(([type]) => type === "trigger")
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
  expect(triggers).toEqual([
    "set_descriptions_modified_at",
    "set_entries_modified_at",
    "set_folders_modified_at",
    "set_instructions_modified_at",
    "set_senses_modified_at",
    "update_folder_on_entry_delete",
    "update_folder_on_entry_insert",
    "update_folder_on_entry_update",
  ]);

  const foreignKeysEnabled = await client.db.values<[number]>(
    sql.raw("PRAGMA foreign_keys")
  );
  const descriptionForeignKeys = await client.db.values<
    [number, number, string, string, string, string, string, string]
  >(sql.raw("PRAGMA foreign_key_list(descriptions)"));
  expect(foreignKeysEnabled).toEqual([[1]]);
  expect(descriptionForeignKeys).toEqual(
    expect.arrayContaining([
      [0, 0, "senses", "sense_id", "id", "NO ACTION", "SET NULL", "NONE"],
      [1, 0, "entries", "entry_id", "id", "NO ACTION", "CASCADE", "NONE"],
    ])
  );

  const childFolder = await folders.save({ name: "child", parentId: root.id });
  if (childFolder instanceof Error) throw childFolder;
  const entry = await entries.save({ folderId: root.id, text: "before" });
  if (entry instanceof Error) throw entry;
  const description = await descriptions.save({
    entryId: entry.id,
    text: "before",
  });
  if (description instanceof Error) throw description;
  const sense = await senses.save({ entryId: entry.id, name: "before" });
  if (sense instanceof Error) throw sense;
  const instruction = await instructions.save({ text: "before" });
  if (instruction instanceof Error) throw instruction;
  const invalidDescription = await descriptions.save({
    entryId: entry.id,
    text: "invalid type",
    type: "invalid" as never,
  });
  const invalidFolder = await folders.save({
    name: "invalid privacy",
    parentId: root.id,
    privacy: "invalid" as never,
  });
  expect(invalidDescription).toBeInstanceOf(DbError);
  expect(invalidFolder).toBeInstanceOf(DbError);

  await new Promise((resolve) => setTimeout(resolve, 1_100));

  const folderUpdate = await folders.update(childFolder.id, { name: "after" });
  if (folderUpdate instanceof Error) throw folderUpdate;
  const entryUpdate = await entries.update(entry.id, { text: "after" });
  if (entryUpdate instanceof Error) throw entryUpdate;
  const descriptionUpdate = await descriptions.update(description.id, {
    text: "after",
  });
  if (descriptionUpdate instanceof Error) throw descriptionUpdate;
  const senseUpdate = await senses.update(sense.id, { name: "after" });
  if (senseUpdate instanceof Error) throw senseUpdate;
  const instructionUpdate = await instructions.update(instruction.id, {
    text: "after",
  });
  if (instructionUpdate instanceof Error) throw instructionUpdate;

  const updatedFolder = await folders.findById(childFolder.id);
  if (updatedFolder instanceof Error) throw updatedFolder;
  if (updatedFolder === null) throw new Error("Updated Folder not found");
  const updatedEntry = await entries.findById(entry.id);
  if (updatedEntry instanceof Error) throw updatedEntry;
  if (updatedEntry === null) throw new Error("Updated Entry not found");
  const updatedDescription = await descriptions.findById(description.id);
  if (updatedDescription instanceof Error) throw updatedDescription;
  if (updatedDescription === null)
    throw new Error("Updated Description not found");
  const updatedSense = await senses.findById(sense.id);
  if (updatedSense instanceof Error) throw updatedSense;
  if (updatedSense === null) throw new Error("Updated Sense not found");
  const updatedInstruction = await instructions.findById(instruction.id);
  if (updatedInstruction instanceof Error) throw updatedInstruction;
  if (updatedInstruction === null)
    throw new Error("Updated Instruction not found");

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
});
