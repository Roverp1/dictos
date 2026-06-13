import { beforeAll, afterAll, describe, it, expect } from "bun:test";
import fs from "fs/promises";

import type { SyncPort } from "./sync-port";
import type { EntryRepository } from "./entry-repository";
import type { FolderRepository } from "./folder-repository";
import type { NewEntry } from "../../models";

export interface SyncClientInstance {
  sync: SyncPort;
  entryRepo: EntryRepository;
  folderRepo: FolderRepository;
}

export interface SyncContractHarness {
  setupRemoteServer(): Promise<string>;
  teardownRemoteServer(): Promise<void>;

  createClient(localDbPath: string): Promise<SyncClientInstance>;
}

export const TEST_DIR = ".test-data/sync-tests";

export const runSyncContractTests = (harness: SyncContractHarness) => {
  describe("SyncPort Contract", () => {
    let remoteUrl: string;

    beforeAll(async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });

      remoteUrl = await harness.setupRemoteServer();
    });

    afterAll(async () => {
      await harness.teardownRemoteServer();

      await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    it("should return a SyncError if syncing without connecting first", async () => {
      const { sync } = await harness.createClient(`${TEST_DIR}/test.db`);

      const res = await sync.sync();

      expect(res instanceof Error).toBe(true);
    });

    it("stops syncing after disconnecting", async () => {
      const { sync } = await harness.createClient(`${TEST_DIR}/test.db`);
      await sync.connectRemote(remoteUrl, "mock-token");

      await sync.disconnectRemote();

      const syncRes = await sync.sync();
      expect(syncRes instanceof Error).toBe(true);
    });

    it("pushes changes from client A and pulls them into client B", async () => {
      const clientA = await harness.createClient(`${TEST_DIR}/testA.db`);
      const clientB = await harness.createClient(`${TEST_DIR}/testB.db`);

      await clientA.sync.connectRemote(remoteUrl, "mock-token");
      await clientB.sync.connectRemote(remoteUrl, "mock-token");

      const rootFolderA = await clientA.folderRepo.findRoot();
      if (rootFolderA instanceof Error) throw rootFolderA;

      const text = "hello from client A";
      const entryData: NewEntry = {
        text,
        folderId: rootFolderA.id,
      };

      const saveRes = await clientA.entryRepo.save(entryData);
      expect(saveRes instanceof Error).toBe(false);

      const syncA = await clientA.sync.sync();
      if (syncA instanceof Error) {
        console.error("SYNC 'A' FAILED:", syncA);
      }
      expect(syncA instanceof Error).toBe(false);

      const syncB = await clientB.sync.sync();
      expect(syncB instanceof Error).toBe(false);

      if (!(saveRes instanceof Error)) {
        const retrieved = await clientB.entryRepo.findById(saveRes.id);
        expect(retrieved instanceof Error).toBe(false);
        if (!(retrieved instanceof Error)) {
          expect(retrieved?.text).toBe(text);
        }
      }
    });
  });
};
