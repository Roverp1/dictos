import { describe, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  sqliteSchemaContract,
  type SqliteSchemaContractHarness,
} from "@dictos/db-core/testing";
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

async function withBunSchemaHarness(
  run: (harness: SqliteSchemaContractHarness) => Promise<void>
) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-fresh-schema-")
  );
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    testLogger
  );

  try {
    await run({
      db: client.db,
      deviceId: crypto.randomUUID(),
      waitForTimestampChange: () => Bun.sleep(1_100),
    });
  } finally {
    const closed = await client.close();
    await fs.rm(directory, { recursive: true, force: true });
    if (closed instanceof Error) throw closed;
  }
}

describe("fresh Bun SQLite migration contract", () => {
  for (const contractCase of sqliteSchemaContract) {
    test(contractCase.name, () =>
      withBunSchemaHarness((harness) => contractCase.run(harness))
    );
  }
});
