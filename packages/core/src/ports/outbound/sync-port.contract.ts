import type { NewEntry } from "../../models";
import type { ContractCase } from "../../testing/contract-case";
import type { EntryRepository } from "./entry-repository";
import type { FolderRepository } from "./folder-repository";
import type { SyncPort } from "./sync-port";

export interface SyncClientInstance {
  sync: SyncPort;
  entryRepo: EntryRepository;
  folderRepo: FolderRepository;
}

export interface SyncContractHarness {
  remoteUrl: string;
  createClient(name: string): Promise<SyncClientInstance>;
}

export const syncPortContract = [
  {
    name: "returns an error when syncing before connecting",
    async run(harness) {
      const { sync } = await harness.createClient("not-connected");
      const result = await sync.sync();

      if (!(result instanceof Error))
        throw new Error("Sync succeeded without a remote connection");
    },
  },
  {
    name: "stops syncing after disconnecting",
    async run(harness) {
      const { sync } = await harness.createClient("disconnected");
      const connected = await sync.connectRemote(
        harness.remoteUrl,
        "mock-token"
      );
      if (connected instanceof Error) throw connected;

      await sync.disconnectRemote();
      const result = await sync.sync();

      if (!(result instanceof Error))
        throw new Error("Sync succeeded after disconnecting");
    },
  },
  {
    name: "pushes changes from client A and pulls them into client B",
    async run(harness) {
      const clientA = await harness.createClient("push-pull-a");
      const clientB = await harness.createClient("push-pull-b");
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

      const rootFolderA = await clientA.folderRepo.findRoot();
      if (rootFolderA instanceof Error) throw rootFolderA;
      const text = "hello from client A";
      const saved = await clientA.entryRepo.save({
        text,
        folderId: rootFolderA.id,
      });
      if (saved instanceof Error) throw saved;

      const syncedA = await clientA.sync.sync();
      if (syncedA instanceof Error) throw syncedA;
      const syncedB = await clientB.sync.sync();
      if (syncedB instanceof Error) throw syncedB;
      const retrieved = await clientB.entryRepo.findById(saved.id);
      if (retrieved instanceof Error) throw retrieved;

      if (retrieved?.text !== text)
        throw new Error("Client B did not pull the Entry from client A");
    },
  },
  {
    name: "merges identical offline Entries deterministically",
    async run(harness) {
      const clientA = await harness.createClient("merge-a");
      const clientB = await harness.createClient("merge-b");
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

      const rootFolderA = await clientA.folderRepo.findRoot();
      if (rootFolderA instanceof Error) throw rootFolderA;
      const rootFolderB = await clientB.folderRepo.findRoot();
      if (rootFolderB instanceof Error) throw rootFolderB;
      const identicalText = "deterministic collision test";
      const dataA: NewEntry = {
        text: identicalText,
        folderId: rootFolderA.id,
      };
      const dataB: NewEntry = {
        text: identicalText,
        folderId: rootFolderB.id,
      };
      const savedA = await clientA.entryRepo.save(dataA);
      if (savedA instanceof Error) throw savedA;
      const savedB = await clientB.entryRepo.save(dataB);
      if (savedB instanceof Error) throw savedB;

      const syncedA = await clientA.sync.sync();
      if (syncedA instanceof Error) throw syncedA;
      const syncedB = await clientB.sync.sync();
      if (syncedB instanceof Error) throw syncedB;
      const allEntriesA = await clientA.entryRepo.findByFolder(rootFolderA.id);
      if (allEntriesA instanceof Error) throw allEntriesA;
      const allEntriesB = await clientB.entryRepo.findByFolder(rootFolderB.id);
      if (allEntriesB instanceof Error) throw allEntriesB;

      const sharedIds = allEntriesA.filter((entryA) =>
        allEntriesB.some((entryB) => entryB.id === entryA.id)
      );
      if (sharedIds.length !== 1)
        throw new Error("Identical offline Entries did not merge once");
    },
  },
  {
    name: "resolves concurrent edits with last-write-wins",
    async run(harness) {
      const clientA = await harness.createClient("concurrent-a");
      const clientB = await harness.createClient("concurrent-b");
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

      const rootFolderA = await clientA.folderRepo.findRoot();
      if (rootFolderA instanceof Error) throw rootFolderA;
      const saved = await clientA.entryRepo.save({
        text: "Initial State",
        folderId: rootFolderA.id,
      });
      if (saved instanceof Error) throw saved;
      const initialSyncA = await clientA.sync.sync();
      if (initialSyncA instanceof Error) throw initialSyncA;
      const initialSyncB = await clientB.sync.sync();
      if (initialSyncB instanceof Error) throw initialSyncB;

      const updatedA = await clientA.entryRepo.update(saved.id, {
        text: "ClientA Edit",
      });
      if (updatedA instanceof Error) throw updatedA;
      const winningText = "ClientB Edit";
      const updatedB = await clientB.entryRepo.update(saved.id, {
        text: winningText,
      });
      if (updatedB instanceof Error) throw updatedB;
      const syncedA = await clientA.sync.sync();
      if (syncedA instanceof Error) throw syncedA;
      const syncedB = await clientB.sync.sync();
      if (syncedB instanceof Error) throw syncedB;
      const finalSyncA = await clientA.sync.sync();
      if (finalSyncA instanceof Error) throw finalSyncA;

      const finalA = await clientA.entryRepo.findById(saved.id);
      if (finalA instanceof Error) throw finalA;
      const finalB = await clientB.entryRepo.findById(saved.id);
      if (finalB instanceof Error) throw finalB;

      if (finalA?.text !== finalB?.text || finalA?.text !== winningText)
        throw new Error("Concurrent Entry edits did not converge");
    },
  },
] satisfies readonly ContractCase<SyncContractHarness>[];
