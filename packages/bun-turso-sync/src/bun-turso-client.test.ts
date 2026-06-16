import { describe } from "bun:test";
import { spawn, spawnSync, type Subprocess, type SyncSubprocess } from "bun";
import path from "path";

import {
  runSyncContractTests,
  TEST_DIR,
  type SyncContractHarness,
} from "@dictos/core/testing";
import { SqliteEntryRepository, SqliteFolderRepository } from "@dictos/db-core";
import type { Logger } from "@dictos/logger";

import { BunTursoClient } from "./bun-turso-client";
import { randomUUID } from "crypto";

const testLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => testLogger,
};

let syncServerProcess: Subprocess | null = null;
const SYNC_PORT = 9090;

const bunHarness: SyncContractHarness = {
  setupRemoteServer: async (serverDbPath) => {
    syncServerProcess = spawn(
      ["tursodb", serverDbPath, "--sync-server", `0.0.0.0:${SYNC_PORT}`],
      {
        stdout: "ignore",
        stderr: "ignore",
      }
    );

    // await new Promise((resolve) => setTimeout(resolve, 500));

    return `http://127.0.0.1:${SYNC_PORT}`;
  },

  teardownRemoteServer: async () => {
    if (!syncServerProcess) return;

    syncServerProcess.kill();
    syncServerProcess = null;
  },

  createClient: async (localDbPath: string) => {
    const absolutePath = path.resolve(process.cwd(), localDbPath);

    const client = await BunTursoClient.create(absolutePath, testLogger);
    const dbProxy = client.db;

    return {
      sync: client,
      entryRepo: new SqliteEntryRepository(dbProxy, randomUUID()),
      folderRepo: new SqliteFolderRepository(dbProxy),
    };
  },
};

describe("BunTursoClient", () => {
  runSyncContractTests(bunHarness);
});
