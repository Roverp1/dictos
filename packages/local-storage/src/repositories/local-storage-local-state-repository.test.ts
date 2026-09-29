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
  test("initializes missing state with no Selected Model and keeps its identity", async () => {
    const { repository } = fixture();
    const first = await repository.getLocalState();
    if (first instanceof Error) throw first;
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.selectedModel).toBeNull();
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
      selectedModel: null,
    });
    expect(await repository.setSelectedModel(null)).toEqual({
      deviceId: "existing-device",
      selectedModel: null,
    });
  });

  test("selection initializes missing state and retains its device ID", async () => {
    const { repository } = fixture();
    const selection = { providerId: "openai", modelId: "gpt-4o" };
    const state = await repository.setSelectedModel(selection);
    if (state instanceof Error) throw state;
    expect(state.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.selectedModel).toEqual(selection);
    expect(await repository.getLocalState()).toEqual(state);
  });

  test("malformed existing state fails without replacing identity until explicit reset", async () => {
    for (const raw of [
      '{"deviceId":',
      "{}",
      '"wrong shape"',
      '{"deviceId":"ok","selectedModel":{"providerId":"openai"}}',
    ]) {
      const { storage, repository } = fixture();
      storage.setItem("dictos_local_state", raw);
      expect(await repository.getLocalState()).toBeInstanceOf(StorageError);
      expect(await repository.setSelectedModel(null)).toBeInstanceOf(
        StorageError
      );
      expect(storage.getItem("dictos_local_state")).toBe(raw);
      const reset = await repository.resetLocalState();
      if (reset instanceof Error) throw reset;
      expect(reset.selectedModel).toBeNull();
      expect(await repository.getLocalState()).toEqual(reset);
    }
  });

  test("selection updates keep identity, clearing selection and reset are explicit", async () => {
    const { repository, logContexts } = fixture();
    const initial = await repository.getLocalState();
    if (initial instanceof Error) throw initial;
    const selection = { providerId: "openai", modelId: "gpt-4o" };
    expect(await repository.setSelectedModel(selection)).toEqual({
      deviceId: initial.deviceId,
      selectedModel: selection,
    });
    expect(await repository.getLocalState()).toEqual({
      deviceId: initial.deviceId,
      selectedModel: selection,
    });
    expect(await repository.setSelectedModel(null)).toEqual(initial);
    const reset = await repository.resetLocalState();
    if (reset instanceof Error) throw reset;
    expect(reset.deviceId).not.toBe(initial.deviceId);
    expect(reset.selectedModel).toBeNull();
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
    expect(await repository.setSelectedModel(null)).toBeInstanceOf(
      StorageError
    );
    storage.getItem = () => JSON.stringify({ deviceId: "existing-device" });
    storage.setItem = () => {
      throw new Error("write unavailable");
    };
    expect(await repository.setSelectedModel(null)).toBeInstanceOf(
      StorageError
    );
    expect(await repository.resetLocalState()).toBeInstanceOf(StorageError);
  });
});
