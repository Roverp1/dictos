import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DbError } from "@dictos/core";
import { SqliteFolderRepository } from "@dictos/db-core";
import type { Logger } from "@dictos/logger";

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

test("returns a database error when the root Folder is missing", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-root-"));
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    testLogger
  );
  const folders = new SqliteFolderRepository(client.db);

  const root = await folders.findRoot();
  if (root instanceof Error) throw root;
  expect(root).toMatchObject({ name: "/", parentId: null });
  const deleted = await folders.delete(root.id);
  if (deleted instanceof Error) throw deleted;

  expect(await folders.findRoot()).toBeInstanceOf(DbError);

  const closed = await client.close();
  if (closed instanceof Error) throw closed;
  await fs.rm(directory, { recursive: true, force: true });
});

test("keeps root Folder initialization idempotent", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-root-"));
  const databasePath = path.join(directory, "dictos.db");
  const firstClient = await BunTursoClient.create(databasePath, testLogger);
  const firstFolders = new SqliteFolderRepository(firstClient.db);
  const firstRoot = await firstFolders.findRoot();
  if (firstRoot instanceof Error) throw firstRoot;
  const firstClose = await firstClient.close();
  if (firstClose instanceof Error) throw firstClose;

  const secondClient = await BunTursoClient.create(databasePath, testLogger);
  const secondFolders = new SqliteFolderRepository(secondClient.db);
  const secondRoot = await secondFolders.findRoot();
  if (secondRoot instanceof Error) throw secondRoot;
  const allFolders = await secondFolders.findAll();
  if (allFolders instanceof Error) throw allFolders;

  expect(secondRoot.id).toBe(firstRoot.id);
  expect(allFolders.filter((folder) => folder.parentId === null)).toEqual([
    secondRoot,
  ]);

  const secondClose = await secondClient.close();
  if (secondClose instanceof Error) throw secondClose;
  await fs.rm(directory, { recursive: true, force: true });
});
