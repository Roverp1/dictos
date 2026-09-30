import { describe, expect, test } from "bun:test";
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
  run: (
    harness: SyncContractHarness,
    closeClient: (name: string) => Promise<void>
  ) => Promise<void>
) {
  const testDirectory = path.resolve(
    process.cwd(),
    ".test-data/sync-tests",
    randomUUID()
  );
  await mkdir(testDirectory, { recursive: true });
  const port = 10_000 + Math.floor(Math.random() * 50_000);
  let server: Subprocess | undefined;
  const clients = new Map<string, BunTursoClient>();

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
        clients.set(name, client);

        return {
          sync: client,
          entryRepo: new SqliteEntryRepository(client.db, randomUUID()),
          folderRepo: new SqliteFolderRepository(client.db),
        };
      },
    };

    await run(harness, async (name) => {
      const client = clients.get(name);
      if (!client) throw new Error("Sync test client was not open");
      const closed = await client.close();
      if (closed instanceof Error) throw closed;
      clients.delete(name);
    });
  } finally {
    if (server) {
      server.kill();
      await server.exited;
    }
    const closeResults = await Promise.all(
      [...clients.values()].reverse().map((client) => client.close())
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

  test("continues syncing local Entries after checkpoint and reconnect", () =>
    withBunSyncHarness(async (harness, closeClient) => {
      const clientA = await harness.createClient("reconnect-a");
      const clientB = await harness.createClient("reconnect-b");
      const connectedA = await clientA.sync.connectRemote(
        harness.remoteUrl,
        "mock-token"
      );
      if (connectedA instanceof Error) throw connectedA;
      const connectedB = await clientB.sync.connectRemote(
        harness.remoteUrl,
        "mock-token"
      );
      if (connectedB instanceof Error) throw connectedB;

      const root = await clientA.folderRepo.findRoot();
      if (root instanceof Error) throw root;
      const first = await clientA.entryRepo.save({
        text: "before reconnect",
        folderId: root.id,
      });
      if (first instanceof Error) throw first;
      const firstSync = await clientA.sync.sync();
      if (firstSync instanceof Error) throw firstSync;

      await closeClient("reconnect-a");
      const reopened = await harness.createClient("reconnect-a");
      const persisted = await reopened.entryRepo.findById(first.id);
      if (persisted instanceof Error) throw persisted;
      expect(persisted?.text).toBe("before reconnect");
      const reconnected = await reopened.sync.connectRemote(
        harness.remoteUrl,
        "mock-token"
      );
      if (reconnected instanceof Error) throw reconnected;

      const second = await reopened.entryRepo.save({
        text: "after reconnect",
        folderId: root.id,
      });
      if (second instanceof Error) throw second;
      const secondSync = await reopened.sync.sync();
      if (secondSync instanceof Error) throw secondSync;
      const pulled = await clientB.sync.sync();
      if (pulled instanceof Error) throw pulled;
      const received = await clientB.entryRepo.findById(second.id);
      if (received instanceof Error) throw received;
      expect(received?.text).toBe("after reconnect");
    })
  );
});
