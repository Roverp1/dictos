import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StorageError, ValidationError } from "@dictos/core";
import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";

import { FsProviderConnectionRepository } from "./fs-provider-connection-repository";

async function fixture(cleanup: errore.AsyncDisposableStack) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-providers-")
  );
  cleanup.defer(() => fs.rm(directory, { recursive: true, force: true }));
  const events: unknown[] = [];
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: (...args) => {
      events.push(args);
    },
    warn: () => {},
    error: (...args) => {
      events.push(args);
    },
    fatal: () => {},
    child: () => logger,
  };
  return {
    directory,
    events,
    logger,
    repository: new FsProviderConnectionRepository({
      dataDir: directory,
      logger,
    }),
  };
}

describe("FsProviderConnectionRepository", () => {
  test("creates one credential per Provider ID and returns only safe results", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, events, repository } = await fixture(cleanup);
    expect(
      await repository.create({ providerId: "google", apiKey: "secret-google" })
    ).toEqual({ providerId: "google" });
    expect(
      await repository.create({ providerId: "openai", apiKey: "secret-openai" })
    ).toEqual({ providerId: "openai" });
    expect(await repository.findAll()).toEqual([
      { providerId: "google" },
      { providerId: "openai" },
    ]);
    expect(await repository.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret-google",
    });
    expect(await repository.findByProviderId("missing")).toBeNull();
    const duplicate = await repository.create({
      providerId: "google",
      apiKey: "secret-other",
    });
    expect(duplicate).toBeInstanceOf(ValidationError);
    expect(await repository.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret-google",
    });
    expect(
      await repository.replaceKey({
        providerId: "missing",
        apiKey: "secret-other",
      })
    ).toBeNull();
    expect(
      await repository.replaceKey({
        providerId: "google",
        apiKey: "secret-new",
      })
    ).toEqual({ providerId: "google" });
    expect(await repository.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret-new",
    });
    expect(await repository.delete("missing")).toBeNull();
    expect(await repository.delete("google")).toEqual({ providerId: "google" });
    expect(await repository.findAll()).toEqual([{ providerId: "openai" }]);
    expect(JSON.stringify([duplicate, events])).not.toContain("secret-");
    expect(
      JSON.parse(
        await fs.readFile(path.join(directory, "providers.json"), "utf8")
      )
    ).toEqual({
      version: 1,
      connections: { openai: { apiKey: "secret-openai" } },
    });
    expect(
      (await fs.stat(path.join(directory, "providers.json"))).mode & 0o777
    ).toBe(0o600);
  });

  test("rejects corrupt and legacy files without overwriting credentials or leaking input", async () => {
    for (const raw of [
      '{"apiKey":"secret-corrupt",',
      '{"connections":[{"apiKey":"secret-legacy"}]}',
      '{"version":1,"connections":{"google":{"apiKey":""}}}',
      '{"version":1,"connections":{},"apiKey":"secret-legacy"}',
    ]) {
      await using cleanup = new errore.AsyncDisposableStack();
      const { directory, events, repository } = await fixture(cleanup);
      await fs.writeFile(path.join(directory, "providers.json"), raw);
      expect(await repository.findAll()).toBeInstanceOf(StorageError);
      const result = await repository.create({
        providerId: "openai",
        apiKey: "secret-new",
      });
      expect(result).toBeInstanceOf(StorageError);
      expect(
        await fs.readFile(path.join(directory, "providers.json"), "utf8")
      ).toBe(raw);
      expect(JSON.stringify([result, events])).not.toContain("secret-");
    }
  });

  test("rejects invalid Provider IDs and empty credentials without saving them", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    expect(
      await repository.create({ providerId: "__proto__", apiKey: "secret-key" })
    ).toBeInstanceOf(ValidationError);
    expect(
      await repository.create({ providerId: "google", apiKey: "  " })
    ).toBeInstanceOf(ValidationError);
    expect(await repository.findAll()).toEqual([]);
    expect(
      (await fs.readdir(directory)).filter((name) => name === "providers.json")
    ).toEqual([]);
  });

  test("keeps the previous file on failed replacement and cleans temporary files", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    expect(
      await repository.create({ providerId: "google", apiKey: "secret-old" })
    ).toEqual({ providerId: "google" });
    await fs.mkdir(path.join(directory, "providers.json.lock"));
    const result = await repository.replaceKey({
      providerId: "google",
      apiKey: "secret-new",
    });
    expect(result).toBeInstanceOf(StorageError);
    expect(await repository.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret-old",
    });
    expect(
      (await fs.readdir(directory)).filter((name) => name.endsWith(".tmp"))
    ).toEqual([]);
  });

  test("a failed filesystem write leaves existing credentials readable", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    expect(
      await repository.create({ providerId: "google", apiKey: "secret-old" })
    ).toEqual({ providerId: "google" });
    await fs.chmod(directory, 0o500);
    cleanup.defer(() => fs.chmod(directory, 0o700));
    expect(
      await repository.replaceKey({
        providerId: "google",
        apiKey: "secret-new",
      })
    ).toBeInstanceOf(StorageError);
    expect(await repository.findByProviderId("google")).toEqual({
      providerId: "google",
      apiKey: "secret-old",
    });
    expect(
      (await fs.readdir(directory)).filter((name) => name.endsWith(".tmp"))
    ).toEqual([]);
  });

  test("concurrent repository instances do not lose Provider Connections", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository, logger } = await fixture(cleanup);
    const other = new FsProviderConnectionRepository({
      dataDir: directory,
      logger,
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? other : repository).create({
          providerId: `provider-${i}`,
          apiKey: `secret-${i}`,
        })
      )
    );
    for (const result of results) if (result instanceof Error) throw result;
    const listed = await repository.findAll();
    if (listed instanceof Error) throw listed;
    expect(listed).toHaveLength(20);
    expect(
      (await fs.readdir(directory)).filter((name) => name.endsWith(".lock"))
    ).toEqual([]);
  });

  test("separate CLI processes preserve each other's Provider Connections", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const { directory, repository } = await fixture(cleanup);
    const moduleUrl = new URL(
      "./fs-provider-connection-repository.ts",
      import.meta.url
    ).href;
    const script = `import { FsProviderConnectionRepository } from ${JSON.stringify(moduleUrl)};
      const logger = { trace(){}, debug(){}, info(){}, warn(){}, error(){}, fatal(){}, child(){ return this } };
      const repository = new FsProviderConnectionRepository({ dataDir: process.argv[1], logger });
      for (let i = 0; i < 5; i++) {
        const result = await repository.create({ providerId: process.argv[2] + '-' + i, apiKey: 'secret-' + i });
        if (result instanceof Error) process.exit(1);
      }`;
    const processes = Array.from({ length: 4 }, (_, i) =>
      Bun.spawn([process.execPath, "-e", script, directory, `worker-${i}`], {
        stdout: "pipe",
        stderr: "pipe",
      })
    );
    expect(
      await Promise.all(processes.map((process) => process.exited))
    ).toEqual([0, 0, 0, 0]);
    const listed = await repository.findAll();
    if (listed instanceof Error) throw listed;
    expect(listed).toHaveLength(20);
  });
});
