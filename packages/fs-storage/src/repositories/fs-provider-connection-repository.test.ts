import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StorageError } from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { FsProviderConnectionRepository } from "./fs-provider-connection-repository";

const temporaryDirectories: string[] = [];

type ErrorEvent = {
  message: string;
  error: unknown;
  context: Context | undefined;
};

async function createRepository() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-providers-")
  );
  temporaryDirectories.push(directory);
  const errorEvents: ErrorEvent[] = [];
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (message, error, context) =>
      errorEvents.push({ message, error, context }),
    fatal: () => {},
    child: () => logger,
  };
  return {
    directory,
    errorEvents,
    repository: new FsProviderConnectionRepository({
      dataDir: directory,
      logger,
    }),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe("FsProviderConnectionRepository", () => {
  test("persists, redacts, updates, and deletes provider connections", async () => {
    const { directory, repository } = await createRepository();
    const created = await repository.save({
      name: "Local provider",
      presetId: null,
      baseUrl: "http://localhost:1234/v1",
      apiKey: "secret-key",
    });
    if (created instanceof Error) throw created;

    expect(created).toEqual({
      id: created.id,
      name: "Local provider",
      presetId: null,
      baseUrl: "http://localhost:1234/v1",
    });
    expect("apiKey" in created).toBe(false);

    const stored = await repository.findById(created.id);
    if (stored instanceof Error) throw stored;
    expect(stored).toEqual({ ...created, apiKey: "secret-key" });

    const updated = await repository.update(created.id, {
      name: "Updated provider",
      presetId: "openai",
      apiKey: "replacement-key",
    });
    if (updated instanceof Error) throw updated;
    expect(updated).toEqual({
      ...created,
      name: "Updated provider",
      presetId: "openai",
    });
    expect("apiKey" in updated).toBe(false);

    const listed = await repository.findAll();
    if (listed instanceof Error) throw listed;
    expect(listed).toEqual([updated]);

    const file = await fs.readFile(
      path.join(directory, "providers.json"),
      "utf8"
    );
    expect(file).toContain("replacement-key");

    const deleted = await repository.delete(created.id);
    if (deleted instanceof Error) throw deleted;
    expect(deleted).toEqual(updated);
    expect(await repository.findById(created.id)).toBeNull();
  });

  test("stores provider credentials with owner-only file permissions", async () => {
    const { directory, repository } = await createRepository();
    const created = await repository.save({
      name: "Local provider",
      presetId: null,
      baseUrl: "http://localhost:1234/v1",
      apiKey: "secret-key",
    });
    if (created instanceof Error) throw created;

    const metadata = await fs.stat(path.join(directory, "providers.json"));
    expect(metadata.mode & 0o777).toBe(0o600);
  });

  test("returns a storage error for corrupt provider JSON", async () => {
    const { directory, errorEvents, repository } = await createRepository();
    await fs.writeFile(
      path.join(directory, "providers.json"),
      '{"apiKey":"top-secret-key",',
      "utf8"
    );

    const result = await repository.findAll();
    expect(result).toBeInstanceOf(StorageError);
    if (!(result instanceof StorageError)) return;
    expect(result.operation).toBe("parse_provider_connections");
    expect(errorEvents[0]).toMatchObject({
      message: "Provider Connection storage read failed",
      error: result,
      context: { operation: "parse_provider_connections" },
    });
    expect(result.cause).toBeInstanceOf(Error);
    if (!(result.cause instanceof Error)) return;
    expect(result.cause.message).toBe(
      "Provider storage JSON could not be parsed"
    );
    expect(JSON.stringify(errorEvents[0])).not.toContain("top-secret-key");
  });
});
