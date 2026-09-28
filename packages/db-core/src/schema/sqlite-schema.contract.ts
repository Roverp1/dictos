import { DbError } from "@dictos/core";
import type { ContractCase } from "@dictos/core/testing";
import { sql } from "drizzle-orm";

import {
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteInstructionRepository,
  SqliteSenseRepository,
} from "../repositories";
import type { SqliteTursoDrizzleProxy } from "../repositories/types";

const REQUIRED_TABLES = [
  "activities",
  "descriptions",
  "entries",
  "folders",
  "instructions",
  "outbox",
  "senses",
  "users",
];

const EXPECTED_INDEXES = [
  "descriptions_entry_id_idx",
  "descriptions_sense_id_idx",
  "senses_entry_id_idx",
];

const EXPECTED_TRIGGERS = [
  "set_descriptions_modified_at",
  "set_entries_modified_at",
  "set_folders_modified_at",
  "set_instructions_modified_at",
  "set_senses_modified_at",
  "update_folder_on_entry_delete",
  "update_folder_on_entry_insert",
  "update_folder_on_entry_update",
];

type ForeignKeyRow = [
  number,
  number,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface SqliteSchemaContractHarness {
  db: SqliteTursoDrizzleProxy;
  deviceId: string;
  waitForTimestampChange(): Promise<void>;
}

function normalizeForeignKeys(rows: ForeignKeyRow[]) {
  return rows
    .map(([, , table, from, to, , onDelete]) => [table, from, to, onDelete])
    .sort((left, right) => left[1]!.localeCompare(right[1]!));
}

export const sqliteSchemaContract = [
  {
    name: "creates the planned tables, indexes, and checks",
    async run(harness) {
      const schemaObjects = await harness.db.values<
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
      const missingTables = REQUIRED_TABLES.filter(
        (table) => !tables.includes(table)
      );
      if (missingTables.length > 0)
        throw new Error(`Missing migrated tables: ${missingTables.join(", ")}`);
      const indexes = schemaObjects
        .filter(([type]) => type === "index")
        .map(([, name]) => name);
      if (JSON.stringify(indexes) !== JSON.stringify(EXPECTED_INDEXES))
        throw new Error(`Unexpected indexes: ${JSON.stringify(indexes)}`);

      const folders = new SqliteFolderRepository(harness.db);
      const entries = new SqliteEntryRepository(harness.db, harness.deviceId);
      const descriptions = new SqliteDescriptionRepository(harness.db);
      const root = await folders.findRoot();
      if (root instanceof Error) throw root;
      const entry = await entries.save({
        folderId: root.id,
        text: "schema checks",
      });
      if (entry instanceof Error) throw entry;
      const invalidDescription = await descriptions.save({
        entryId: entry.id,
        text: "invalid type",
        type: "invalid" as never,
      });
      if (!(invalidDescription instanceof DbError))
        throw new Error("Description Type check accepted an invalid value");
      const invalidFolder = await folders.save({
        name: "invalid privacy",
        parentId: root.id,
        privacy: "invalid" as never,
      });
      if (!(invalidFolder instanceof DbError))
        throw new Error("Folder privacy check accepted an invalid value");
    },
  },
  {
    name: "creates and enables the planned foreign keys",
    async run(harness) {
      const foreignKeysEnabled = await harness.db.values<[number]>(
        sql.raw("PRAGMA foreign_keys")
      );
      if (foreignKeysEnabled[0]?.[0] !== 1)
        throw new Error("SQLite foreign keys are not enabled");

      const descriptionForeignKeys = normalizeForeignKeys(
        await harness.db.values<ForeignKeyRow>(
          sql.raw("PRAGMA foreign_key_list(descriptions)")
        )
      );
      const expectedDescriptionForeignKeys = [
        ["entries", "entry_id", "id", "CASCADE"],
        ["senses", "sense_id", "id", "SET NULL"],
      ];
      if (
        JSON.stringify(descriptionForeignKeys) !==
        JSON.stringify(expectedDescriptionForeignKeys)
      )
        throw new Error(
          `Unexpected Description foreign keys: ${JSON.stringify(descriptionForeignKeys)}`
        );

      const senseForeignKeys = normalizeForeignKeys(
        await harness.db.values<ForeignKeyRow>(
          sql.raw("PRAGMA foreign_key_list(senses)")
        )
      );
      if (
        JSON.stringify(senseForeignKeys) !==
        JSON.stringify([["entries", "entry_id", "id", "CASCADE"]])
      )
        throw new Error(
          `Unexpected Sense foreign keys: ${JSON.stringify(senseForeignKeys)}`
        );

      const entryForeignKeys = normalizeForeignKeys(
        await harness.db.values<ForeignKeyRow>(
          sql.raw("PRAGMA foreign_key_list(entries)")
        )
      );
      if (
        JSON.stringify(entryForeignKeys) !==
        JSON.stringify([["folders", "folder_id", "id", "CASCADE"]])
      )
        throw new Error(
          `Unexpected Entry foreign keys: ${JSON.stringify(entryForeignKeys)}`
        );
    },
  },
  {
    name: "installs working lifecycle triggers",
    async run(harness) {
      const triggerRows = await harness.db.values<[string]>(
        sql.raw(`
          SELECT name
          FROM sqlite_schema
          WHERE type = 'trigger'
          ORDER BY name
        `)
      );
      const triggers = triggerRows.map(([name]) => name);
      if (JSON.stringify(triggers) !== JSON.stringify(EXPECTED_TRIGGERS))
        throw new Error(`Unexpected triggers: ${JSON.stringify(triggers)}`);

      const folders = new SqliteFolderRepository(harness.db);
      const entries = new SqliteEntryRepository(harness.db, harness.deviceId);
      const descriptions = new SqliteDescriptionRepository(harness.db);
      const senses = new SqliteSenseRepository(harness.db);
      const instructions = new SqliteInstructionRepository(harness.db);
      const root = await folders.findRoot();
      if (root instanceof Error) throw root;
      const childFolder = await folders.save({
        name: "child",
        parentId: root.id,
      });
      if (childFolder instanceof Error) throw childFolder;
      const relationFolder = await folders.save({
        name: "relation triggers",
        parentId: root.id,
      });
      if (relationFolder instanceof Error) throw relationFolder;
      const entry = await entries.save({ folderId: root.id, text: "before" });
      if (entry instanceof Error) throw entry;
      const description = await descriptions.save({
        entryId: entry.id,
        text: "before",
      });
      if (description instanceof Error) throw description;
      const sense = await senses.save({
        entryId: entry.id,
        name: "before",
      });
      if (sense instanceof Error) throw sense;
      const instruction = await instructions.save({ text: "before" });
      if (instruction instanceof Error) throw instruction;

      await harness.waitForTimestampChange();

      const folderUpdate = await folders.update(childFolder.id, {
        name: "after",
      });
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
      const insertedEntry = await entries.save({
        folderId: relationFolder.id,
        text: "folder insert trigger",
      });
      if (insertedEntry instanceof Error) throw insertedEntry;

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
      const relationFolderAfterInsert = await folders.findById(
        relationFolder.id
      );
      if (relationFolderAfterInsert instanceof Error)
        throw relationFolderAfterInsert;
      if (relationFolderAfterInsert === null)
        throw new Error("Entry relation Folder not found");

      if (updatedFolder.modifiedAt <= childFolder.modifiedAt)
        throw new Error("Folder lifecycle trigger did not update modifiedAt");
      if (updatedEntry.modifiedAt <= entry.modifiedAt)
        throw new Error("Entry lifecycle trigger did not update modifiedAt");
      if (updatedDescription.modifiedAt <= description.modifiedAt)
        throw new Error(
          "Description lifecycle trigger did not update modifiedAt"
        );
      if (updatedSense.modifiedAt <= sense.modifiedAt)
        throw new Error("Sense lifecycle trigger did not update modifiedAt");
      if (updatedInstruction.modifiedAt <= instruction.modifiedAt)
        throw new Error(
          "Instruction lifecycle trigger did not update modifiedAt"
        );
      if (relationFolderAfterInsert.modifiedAt <= relationFolder.modifiedAt)
        throw new Error("Entry insertion did not update its Folder");

      await harness.waitForTimestampChange();

      const relationUpdate = await entries.update(insertedEntry.id, {
        text: "folder update trigger",
      });
      if (relationUpdate instanceof Error) throw relationUpdate;
      const relationFolderAfterUpdate = await folders.findById(
        relationFolder.id
      );
      if (relationFolderAfterUpdate instanceof Error)
        throw relationFolderAfterUpdate;
      if (relationFolderAfterUpdate === null)
        throw new Error("Entry relation Folder not found after update");
      if (
        relationFolderAfterUpdate.modifiedAt <=
        relationFolderAfterInsert.modifiedAt
      )
        throw new Error("Entry update did not update its Folder");

      await harness.waitForTimestampChange();

      const relationDelete = await entries.delete(insertedEntry.id);
      if (relationDelete instanceof Error) throw relationDelete;
      const relationFolderAfterDelete = await folders.findById(
        relationFolder.id
      );
      if (relationFolderAfterDelete instanceof Error)
        throw relationFolderAfterDelete;
      if (relationFolderAfterDelete === null)
        throw new Error("Entry relation Folder not found after delete");
      if (
        relationFolderAfterDelete.modifiedAt <=
        relationFolderAfterUpdate.modifiedAt
      )
        throw new Error("Entry deletion did not update its Folder");
    },
  },
] satisfies readonly ContractCase<SqliteSchemaContractHarness>[];
