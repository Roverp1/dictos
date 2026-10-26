// @ts-expect-error Bun's test types are not a dependency of the browser adapter.
import { afterEach, describe, expect, test } from "bun:test";

import { StorageError, type LocalStateRepository } from "@dictos/core";
import type { Logger } from "@dictos/logger";

import { LocalStorageLocalStateRepository } from "./local-storage-local-state-repository";

const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage"
);
afterEach(() => {
  if (originalStorage)
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

function fixture() {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  const logContexts: unknown[] = [];
  const logger: Logger = {
    child: () => logger,
    trace: () => {},
    debug: () => {},
    info: (_message, context) => {
      logContexts.push(context);
    },
    warn: () => {},
    error: () => {},
    fatal: () => {},
  };
  return {
    storage,
    logContexts,
    repository: new LocalStorageLocalStateRepository(
      logger
    ) as LocalStateRepository,
  };
}

describe("LocalStorageLocalStateRepository", () => {
  test("initializes missing device identity and keeps it", async () => {
    const { repository } = fixture();
    const first = await repository.getLocalState();
    if (first instanceof Error) throw first;
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repository.getLocalState()).toEqual(first);
  });

  test("keeps the device ID from existing device-only state", async () => {
    const { storage, repository } = fixture();
    storage.setItem(
      "dictos_local_state",
      JSON.stringify({ deviceId: "existing-device" })
    );
    expect(await repository.getLocalState()).toEqual({
      deviceId: "existing-device",
    });
  });

  test("malformed existing state fails without replacing identity until explicit reset", async () => {
    for (const raw of [
      '{"deviceId":',
      "{}",
      '"wrong shape"',
      '{"deviceId":""}',
    ]) {
      const { storage, repository } = fixture();
      storage.setItem("dictos_local_state", raw);
      expect(await repository.getLocalState()).toBeInstanceOf(StorageError);
      expect(storage.getItem("dictos_local_state")).toBe(raw);
      const reset = await repository.resetLocalState();
      if (reset instanceof Error) throw reset;
      expect(await repository.getLocalState()).toEqual(reset);
    }
  });

  test("explicit reset replaces identity", async () => {
    const { repository, logContexts } = fixture();
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    const reset = await repository.resetLocalState();
    if (reset instanceof Error) throw reset;
    expect(reset.deviceId).not.toBe(initial.deviceId);
    expect(await repository.getLocalState()).toEqual(reset);
    expect(logContexts).toEqual([undefined, undefined]);
  });

  test("storage failures return StorageError without resetting identity", async () => {
    const { storage, repository } = fixture();
    storage.setItem(
      "dictos_local_state",
      JSON.stringify({ deviceId: "existing-device" })
    );
    storage.getItem = () => {
      throw new Error("read unavailable");
    };
    expect(await repository.getLocalState()).toBeInstanceOf(StorageError);
    storage.getItem = () => JSON.stringify({ deviceId: "existing-device" });
    storage.setItem = () => {
      throw new Error("write unavailable");
    };
    expect(await repository.resetLocalState()).toBeInstanceOf(StorageError);
  });
});
