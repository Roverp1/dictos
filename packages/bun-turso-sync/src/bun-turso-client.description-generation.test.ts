import { describe, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  descriptionGenerationRepositoryContract,
  senseRepositoryContract,
  type DescriptionGenerationRepositoryContractHarness,
  type SenseRepositoryContractHarness,
} from "@dictos/core/testing";
import {
  SqliteDescriptionGenerationRepository,
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteSenseRepository,
} from "@dictos/db-core";
import type { Logger } from "@dictos/logger";
import { sql } from "drizzle-orm";

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

type BunPersistenceHarness = DescriptionGenerationRepositoryContractHarness &
  SenseRepositoryContractHarness;

async function withBunPersistenceHarness(
  run: (harness: BunPersistenceHarness) => Promise<void>
) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-description-generation-")
  );
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    testLogger
  );

  try {
    const folders = new SqliteFolderRepository(client.db);
    const root = await folders.findRoot();
    if (root instanceof Error) throw root;
    const entries = new SqliteEntryRepository(client.db, crypto.randomUUID());
    const descriptions = new SqliteDescriptionRepository(client.db);
    const senses = new SqliteSenseRepository(client.db);
    const harness: BunPersistenceHarness = {
      commits: new SqliteDescriptionGenerationRepository(client.db),
      descriptions,
      senses,
      async createEntry(text) {
        const entry = await entries.save({ folderId: root.id, text });
        if (entry instanceof Error) throw entry;
        return entry;
      },
      async failDescriptionInsert() {
        await client.db.run(
          sql.raw(`
            CREATE TRIGGER fail_generated_description
            BEFORE INSERT ON descriptions
            BEGIN
              SELECT RAISE(ABORT, 'forced generated Description failure');
            END
          `)
        );
      },
      async failSenseDelete() {
        await client.db.run(
          sql.raw(`
            CREATE TRIGGER fail_sense_delete
            BEFORE DELETE ON senses
            BEGIN
              SELECT RAISE(ABORT, 'forced Sense deletion failure');
            END
          `)
        );
      },
    };

    await run(harness);
  } finally {
    const closed = await client.close();
    await fs.rm(directory, { recursive: true, force: true });
    if (closed instanceof Error) throw closed;
  }
}

describe("SqliteDescriptionGenerationRepository contract", () => {
  for (const contractCase of descriptionGenerationRepositoryContract) {
    test(contractCase.name, () =>
      withBunPersistenceHarness((harness) => contractCase.run(harness))
    );
  }
});

describe("SqliteSenseRepository contract", () => {
  for (const contractCase of senseRepositoryContract) {
    test(contractCase.name, () =>
      withBunPersistenceHarness((harness) => contractCase.run(harness))
    );
  }
});
