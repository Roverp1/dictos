import {
  beforeAll,
  afterAll,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "bun:test";
import fs from "fs/promises";

import type { SyncPort } from "./sync-port";
import type { EntryRepository } from "./entry-repository";
import type { FolderRepository } from "./folder-repository";
import type { NewEntry } from "../../models";
import { randomUUID } from "crypto";

export interface SyncClientInstance {
  sync: SyncPort;
  entryRepo: EntryRepository;
  folderRepo: FolderRepository;
}

export interface SyncContractHarness {
  setupRemoteServer(serverDbPath: string): Promise<string>;
  teardownRemoteServer(): Promise<void>;

  createClient(localDbPath: string): Promise<SyncClientInstance>;
}

export const TEST_DIR = ".test-data/sync-tests";

export const runSyncContractTests = (harness: SyncContractHarness) => {
  describe("SyncPort Contract", () => {
    let remoteUrl: string;

    beforeAll(async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
    });

    afterAll(async () => {
      await harness.teardownRemoteServer();

      await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    beforeEach(async () => {
      const serverDBPath = `${TEST_DIR}/server-${randomUUID()}.db`;
      remoteUrl = await harness.setupRemoteServer(serverDBPath);
    });

    afterEach(async () => {
      await harness.teardownRemoteServer();
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
      if (saveRes instanceof Error) throw saveRes;

      const syncA = await clientA.sync.sync();
      if (syncA instanceof Error) {
        console.error("SYNC 'A' FAILED:", syncA);
        throw syncA;
      }

      const syncB = await clientB.sync.sync();
      if (syncB instanceof Error) throw syncB;

      const retrieved = await clientB.entryRepo.findById(saveRes.id);
      if (retrieved instanceof Error) throw retrieved;
      expect(retrieved?.text).toBe(text);
    });

    it("merges identical entities created offline deterministically", async () => {
      const clientA = await harness.createClient(`${TEST_DIR}/merge-a.db`);
      const clientB = await harness.createClient(`${TEST_DIR}/merge-b.db`);

      await clientA.sync.connectRemote(remoteUrl, "mock-token");
      await clientB.sync.connectRemote(remoteUrl, "mock-token");

      const rootFolderA = await clientA.folderRepo.findRoot();
      if (rootFolderA instanceof Error) throw rootFolderA;

      const rootFolderB = await clientB.folderRepo.findRoot();
      if (rootFolderB instanceof Error) throw rootFolderB;

      /* @todo replace with randomly generated string */
      const identicalText = "deterministic collision test";
      const dataA: NewEntry = {
        text: identicalText,
        folderId: rootFolderA.id,
      };

      const dataB: NewEntry = {
        text: identicalText,
        folderId: rootFolderB.id,
      };

      await clientA.entryRepo.save(dataA);
      const saveB = await clientB.entryRepo.save(dataB);
      if (saveB instanceof Error) throw saveB;

      const syncA = await clientA.sync.sync();
      if (syncA instanceof Error) throw syncA;

      const syncB = await clientB.sync.sync();
      if (syncB instanceof Error) throw syncB;

      const allEntriesA = await clientA.entryRepo.findByFolder(rootFolderB.id);
      if (allEntriesA instanceof Error) throw allEntriesA;

      const allEntriesB = await clientB.entryRepo.findByFolder(rootFolderB.id);
      if (allEntriesB instanceof Error) throw allEntriesB;

      const matching = allEntriesA.filter((eA) =>
        allEntriesB.some((eB) => eB.id === eA.id)
      );
      expect(matching.length).toBe(1);
    });

    it("handles concurrent edits to the same entity (Last Write Wins)", async () => {
      const clientA = await harness.createClient(`${TEST_DIR}/concurrent-A.db`);
      const clientB = await harness.createClient(`${TEST_DIR}/concurrent-B.db`);

      await clientA.sync.connectRemote(remoteUrl, "mock-token");
      await clientB.sync.connectRemote(remoteUrl, "mock-token");

      const rootFolderA = await clientA.folderRepo.findRoot();
      if (rootFolderA instanceof Error) throw rootFolderA;

      const rootFolderB = await clientB.folderRepo.findRoot();
      if (rootFolderB instanceof Error) throw rootFolderB;

      const entryData: NewEntry = {
        text: "Initial State",
        folderId: rootFolderA.id,
      };

      const saveRes = await clientA.entryRepo.save(entryData);
      if (saveRes instanceof Error) throw saveRes;

      const syncA1 = await clientA.sync.sync();
      if (syncA1 instanceof Error) throw syncA1;
      const syncB1 = await clientB.sync.sync();
      if (syncB1 instanceof Error) throw syncA1;

      const updateA = await clientA.entryRepo.update(saveRes.id, {
        text: "ClientA Edit",
      });
      if (updateA instanceof Error) {
        console.log("updateA failed");
        throw updateA;
      }

      const winningText = "ClientB Edit";
      const updateB = await clientB.entryRepo.update(saveRes.id, {
        text: winningText,
      });
      if (updateB instanceof Error) {
        console.log("updateB failed");
        throw updateB;
      }

      const syncA = await clientA.sync.sync();
      if (syncA instanceof Error) throw syncA;

      const syncB = await clientB.sync.sync();
      if (syncB instanceof Error) throw syncB;

      const finalSyncA = await clientA.sync.sync();
      if (finalSyncA instanceof Error) throw finalSyncA;

      const finalA = await clientA.entryRepo.findById(saveRes.id);
      if (finalA instanceof Error) throw finalA;

      const finalB = await clientB.entryRepo.findById(saveRes.id);
      if (finalB instanceof Error) throw finalB;

      expect(finalA?.text).toBe(finalB?.text);
      expect(finalA?.text).toBe(winningText);
    });
  });
};
