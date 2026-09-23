import { describe, test } from "bun:test";
import { spawn, type Subprocess } from "bun";
import { mkdir, rm } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

import {
  syncPortContract,
  type SyncContractHarness,
} from "@dictos/core/testing";
import { SqliteEntryRepository, SqliteFolderRepository } from "@dictos/db-core";
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

async function withBunSyncHarness(
  run: (harness: SyncContractHarness) => Promise<void>
) {
  const testDirectory = path.resolve(
    process.cwd(),
    ".test-data/sync-tests",
    randomUUID()
  );
  await mkdir(testDirectory, { recursive: true });
  const port = 10_000 + Math.floor(Math.random() * 50_000);
  let server: Subprocess | undefined;
  const clients: BunTursoClient[] = [];

  try {
    server = spawn(
      [
        "tursodb",
        path.join(testDirectory, "server.db"),
        "--sync-server",
        `0.0.0.0:${port}`,
      ],
      { stdout: "ignore", stderr: "ignore" }
    );
    const harness: SyncContractHarness = {
      remoteUrl: `http://127.0.0.1:${port}`,
      async createClient(name) {
        const client = await BunTursoClient.create(
          path.join(testDirectory, `${name}.db`),
          testLogger
        );
        clients.push(client);

        return {
          sync: client,
          entryRepo: new SqliteEntryRepository(client.db, randomUUID()),
          folderRepo: new SqliteFolderRepository(client.db),
        };
      },
    };

    await run(harness);
  } finally {
    if (server) {
      server.kill();
      await server.exited;
    }
    const closeResults = await Promise.all(
      clients.reverse().map((client) => client.close())
    );
    await rm(testDirectory, { recursive: true, force: true });
    const closeError = closeResults.find((result) => result instanceof Error);
    if (closeError instanceof Error) throw closeError;
  }
}

describe("BunTursoClient SyncPort contract", () => {
  for (const contractCase of syncPortContract) {
    test(contractCase.name, () =>
      withBunSyncHarness((harness) => contractCase.run(harness))
    );
  }
});
