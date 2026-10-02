import { expect, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as errore from "@dictos/errore";

import { ScreenEntrySaveService } from "@dictos/core";
import {
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteScreenEntrySaveRepository,
} from "@dictos/db-core";
import type { Logger } from "@dictos/logger";
import { sql } from "drizzle-orm";

import { BunTursoClient } from "./bun-turso-client";

const logger: Logger = {
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

test("center Save keeps the captured Description unassigned and omits Sense drafts", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-reviewed-entry-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));

  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    logger
  );
  cleanup.defer(async () => {
    const result = await client.close();
    if (result instanceof Error) throw result;
  });
  const root = await new SqliteFolderRepository(client.db).findRoot();
  if (root instanceof Error) throw root;
  const service = new ScreenEntrySaveService(
    new SqliteScreenEntrySaveRepository(client.db, crypto.randomUUID())
  );

  const saved = await service.save({
    kind: "entry",
    folderId: root.id,
    entryText: "  read  ",
    descriptionText: "I read a book.",
  });
  if (saved instanceof Error) throw saved;

  const descriptions = await new SqliteDescriptionRepository(
    client.db
  ).findByEntry(saved.entry.id);
  if (descriptions instanceof Error) throw descriptions;
  expect(saved.entry.text).toBe("  read  ");
  expect(saved.sense).toBeNull();
  expect(
    descriptions.map(({ type, text, senseId }) => ({ type, text, senseId }))
  ).toEqual([{ type: "misc", text: "I read a book.", senseId: null }]);
});

test("right Save groups typed Descriptions and only includes captured text when requested", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-reviewed-entry-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    logger
  );
  cleanup.defer(async () => {
    const result = await client.close();
    if (result instanceof Error) throw result;
  });
  const root = await new SqliteFolderRepository(client.db).findRoot();
  if (root instanceof Error) throw root;
  const service = new ScreenEntrySaveService(
    new SqliteScreenEntrySaveRepository(client.db, crypto.randomUUID())
  );
  const descriptions = new SqliteDescriptionRepository(client.db);

  const included = await service.save({
    kind: "sense",
    folderId: root.id,
    entryText: "read",
    descriptionText: "I read a book.",
    includeDescription: true,
    senseName: "written text",
    descriptions: [
      { type: "definition", text: "Interpret written text" },
      { type: "definition", text: "Understand symbols on a page" },
    ],
  });
  if (included instanceof Error) throw included;
  if (included.sense === null) throw new Error("Right Save returned no Sense");
  const savedWithDescription = await descriptions.findByEntry(
    included.entry.id
  );
  if (savedWithDescription instanceof Error) throw savedWithDescription;

  expect(included.sense.name).toBe("written text");
  expect(
    savedWithDescription.map(({ type, senseId }) => ({ type, senseId }))
  ).toEqual([
    { type: "misc", senseId: included.sense.id },
    { type: "definition", senseId: included.sense.id },
    { type: "definition", senseId: included.sense.id },
  ]);

  const excluded = await service.save({
    kind: "sense",
    folderId: root.id,
    entryText: "write",
    descriptionText: "I write a book.",
    includeDescription: false,
    senseName: "create written text",
    descriptions: [{ type: "example", text: "She writes." }],
  });
  if (excluded instanceof Error) throw excluded;
  const savedWithoutDescription = await descriptions.findByEntry(
    excluded.entry.id
  );
  if (savedWithoutDescription instanceof Error) throw savedWithoutDescription;
  expect(excluded.capturedDescription).toBeNull();
  expect(
    savedWithoutDescription.map(({ type, text }) => ({ type, text }))
  ).toEqual([{ type: "example", text: "She writes." }]);
});

test("failed Description insertion rolls back the new Entry and Sense", async () => {
  await using cleanup = new errore.AsyncDisposableStack();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-reviewed-entry-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    logger
  );
  cleanup.defer(async () => {
    const result = await client.close();
    if (result instanceof Error) throw result;
  });
  const root = await new SqliteFolderRepository(client.db).findRoot();
  if (root instanceof Error) throw root;
  await client.db.run(
    sql.raw(`
    CREATE TRIGGER fail_reviewed_description
    BEFORE INSERT ON descriptions
    BEGIN
      SELECT RAISE(ABORT, 'forced reviewed Description failure');
    END
  `)
  );
  const entries = new SqliteEntryRepository(client.db, crypto.randomUUID());
  const service = new ScreenEntrySaveService(
    new SqliteScreenEntrySaveRepository(client.db, crypto.randomUUID())
  );

  const failed = await service.save({
    kind: "sense",
    folderId: root.id,
    entryText: "broken draft",
    descriptionText: "captured text",
    includeDescription: true,
    senseName: "one Sense",
    descriptions: [{ type: "definition", text: "one Definition" }],
  });
  const remaining = await entries.findByFolder(root.id);
  if (remaining instanceof Error) throw remaining;

  expect(failed).toBeInstanceOf(Error);
  expect(remaining).toEqual([]);
});
