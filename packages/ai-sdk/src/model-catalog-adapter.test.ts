import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ModelCatalogError,
  type ModelCatalogPort,
  type ModelCatalogStore,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";
import { FsModelCatalogStore } from "@dictos/fs-storage";

import { ModelCatalogAdapter } from "./model-catalog-adapter";

function fixture(
  dataDir: string,
  fetchImplementation: ConstructorParameters<
    typeof ModelCatalogAdapter
  >[0]["fetchImplementation"]
) {
  const warnings: string[] = [];
  const logger: Logger = {
    child: () => logger,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (message) => {
      warnings.push(message);
    },
    error: () => {},
    fatal: () => {},
  };
  const store = new FsModelCatalogStore({ dataDir });
  return {
    store,
    warnings,
    adapter: new ModelCatalogAdapter({ store, logger, fetchImplementation }),
  };
}

const model = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  modalities: { input: ["text"], output: ["text"] },
  ...overrides,
});
const upstream = (models: Record<string, unknown>) => ({
  google: { id: "google", name: "Google", models },
  unknown: {
    id: "unknown",
    name: "Unknown",
    models: { extra: model("extra") },
  },
});

describe("ModelCatalogAdapter", () => {
  test("lists the bundled catalog offline and prefers a valid persisted refresh", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const { adapter } = fixture(dataDir, async (input, init) => {
        expect(input).toBe("https://models.dev/api.json");
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return Response.json(
          upstream({ "z/part": model("z/part"), alpha: model("alpha") })
        );
      });
      const bundled = await adapter.get();
      if (bundled instanceof Error) throw bundled;
      expect(bundled.source).toBe("bundled");
      expect(bundled.models.length).toBeGreaterThan(0);
      const refreshed = await adapter.refresh();
      if (refreshed instanceof Error) throw refreshed;
      expect(refreshed.models.map((entry) => entry.modelId)).toEqual([
        "alpha",
        "z/part",
      ]);
      const offline = fixture(dataDir, async () => {
        throw new Error("network must not be used");
      });
      expect(await offline.adapter.get()).toEqual(refreshed);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("filters unsupported, deprecated, non-text, overridden and unsafe Models", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const { adapter } = fixture(dataDir, async () =>
        Response.json(
          upstream({
            valid: model("valid", { name: "Safe" }),
            deprecated: model("deprecated", { status: "deprecated" }),
            image: model("image", {
              modalities: { input: ["image"], output: ["text"] },
            }),
            override: model("override", { provider: { npm: "evil" } }),
            "escape\u001b[31m": model("escape\u001b[31m"),
            hostile: model("hostile", { name: "bad\u001b[31m" }),
            huge: model("huge", { name: "x".repeat(201) }),
          })
        )
      );
      const result = await adapter.refresh();
      if (result instanceof Error) throw result;
      expect(result.models.map((entry) => entry.modelId)).toEqual(["valid"]);
      expect(result.providers.map((provider) => provider.id)).toEqual([
        "deepseek",
        "google",
        "groq",
        "openai",
        "openrouter",
      ]);
      expect(JSON.stringify(result)).not.toContain("evil");
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("a partial refresh does not hide a supported Provider with an existing connection", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const { adapter } = fixture(dataDir, async () =>
        Response.json(
          upstream({ "gemini-2.5-flash": model("gemini-2.5-flash") })
        )
      );
      const refreshed = await adapter.refresh();
      if (refreshed instanceof Error) throw refreshed;
      expect(refreshed.providers.map(({ id }) => id)).toContain("openai");

      const offline = fixture(dataDir, async () => {
        throw new Error("Network must not be used");
      });
      const cached = await offline.adapter.get();
      if (cached instanceof Error) throw cached;
      expect(cached.providers.map(({ id }) => id)).toContain("openai");
      expect(cached.models.map(({ modelId }) => modelId)).toEqual([
        "gemini-2.5-flash",
      ]);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("warns and falls back when the cache contains invalid data", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      await fs.writeFile(path.join(dataDir, "model-catalog.json"), "{broken");
      const { adapter, warnings } = fixture(dataDir, async () => {
        throw new Error("offline");
      });
      const result = await adapter.get();
      if (result instanceof Error) throw result;
      expect(result.source).toBe("bundled");
      expect(warnings).toEqual([
        "Model Catalog cache invalid; using bundled catalog",
      ]);
      expect(JSON.stringify(warnings)).not.toContain("broken");
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("rejects a parseable cache whose Model is no longer eligible", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      await fs.writeFile(
        path.join(dataDir, "model-catalog.json"),
        JSON.stringify({
          version: 1,
          fetchedAt: "2026-09-28T00:00:00.000Z",
          providers: [{ id: "google", name: "Google" }],
          models: [
            {
              providerId: "google",
              modelId: "image-only",
              name: "Image only",
              status: "active",
              inputModalities: ["image"],
              outputModalities: ["text"],
            },
          ],
        })
      );
      const { adapter, warnings } = fixture(dataDir, async () => {
        throw new Error("offline");
      });
      const result = await adapter.get();
      if (result instanceof Error) throw result;
      expect(result.source).toBe("bundled");
      expect(warnings).toHaveLength(1);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("a failed refresh returns a tagged error and retains the last good cache", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const first = fixture(dataDir, async () =>
        Response.json(upstream({ stable: model("stable") }))
      );
      const saved = await first.adapter.refresh();
      if (saved instanceof Error) throw saved;
      const failing = fixture(dataDir, async () =>
        Response.json({ error: "key-in-response" }, { status: 503 })
      );
      const result = await failing.adapter.refresh();
      expect(result).toBeInstanceOf(ModelCatalogError);
      expect(JSON.stringify(result)).not.toContain("key-in-response");
      expect(await failing.adapter.get()).toEqual(saved);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("a timed-out fetch cannot replace the previous catalog after it completes", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const first = fixture(dataDir, async () =>
        Response.json(upstream({ stable: model("stable") }))
      );
      const saved = await first.adapter.refresh();
      if (saved instanceof Error) throw saved;

      const pending = Promise.withResolvers<Response>();
      const logger: Logger = {
        child: () => logger,
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      };
      const catalog: ModelCatalogPort = new ModelCatalogAdapter({
        store: first.store,
        logger,
        timeoutMs: 20,
        fetchImplementation: async () => pending.promise,
      });
      const result = await catalog.refresh();
      expect(result).toBeInstanceOf(ModelCatalogError);
      pending.resolve(Response.json(upstream({ late: model("late") })));
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(await catalog.get()).toEqual(saved);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("a slow cache replacement does not return a false timeout before it commits", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const first = fixture(dataDir, async () =>
        Response.json(upstream({ stable: model("stable") }))
      );
      const saved = await first.adapter.refresh();
      if (saved instanceof Error) throw saved;
      const release = Promise.withResolvers<void>();
      const entered = Promise.withResolvers<void>();
      const store: ModelCatalogStore = {
        read: () => first.store.read(),
        replace: async (catalog) => {
          entered.resolve();
          await release.promise;
          return first.store.replace(catalog);
        },
      };
      const logger: Logger = {
        child: () => logger,
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      };
      const catalog: ModelCatalogPort = new ModelCatalogAdapter({
        store,
        logger,
        timeoutMs: 20,
        fetchImplementation: async () =>
          Response.json(upstream({ current: model("current") })),
      });
      const refreshing = catalog.refresh();
      await entered.promise;
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(await catalog.get()).toEqual(saved);
      release.resolve();
      const result = await refreshing;
      if (result instanceof Error) throw result;
      expect(result.models.map((item) => item.modelId)).toEqual(["current"]);
      expect(await catalog.get()).toEqual(result);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("external fetch errors retain a sanitized cause without leaking secrets", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const first = fixture(dataDir, async () =>
        Response.json(upstream({ stable: model("stable") }))
      );
      const saved = await first.adapter.refresh();
      if (saved instanceof Error) throw saved;
      const logs: unknown[] = [];
      const logger: Logger = {
        child: () => logger,
        trace: (message, context) => {
          logs.push([message, context]);
        },
        debug: (message, context) => {
          logs.push([message, context]);
        },
        info: (message, context) => {
          logs.push([message, context]);
        },
        warn: (message, context) => {
          logs.push([message, context]);
        },
        error: (message, error, context) => {
          logs.push([message, error, context]);
        },
        fatal: (message, error, context) => {
          logs.push([message, error, context]);
        },
      };
      const catalog: ModelCatalogPort = new ModelCatalogAdapter({
        store: first.store,
        logger,
        fetchImplementation: async () => {
          throw new Error("secret-external-key");
        },
      });
      const result = await catalog.refresh();
      expect(result).toBeInstanceOf(ModelCatalogError);
      if (!(result instanceof ModelCatalogError)) return;
      expect(result.cause).toBeInstanceOf(Error);
      expect(JSON.stringify(result)).not.toContain("secret-external-key");
      expect(String(result.cause)).not.toContain("secret-external-key");
      expect(JSON.stringify(logs)).not.toContain("secret-external-key");
      expect(await catalog.get()).toEqual(saved);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("limits streamed responses and times out even when fetch ignores abort", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const { store } = fixture(dataDir, async () => Response.json({}));
      const logger: Logger = {
        child: () => logger,
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      };
      const large = new ModelCatalogAdapter({
        store,
        logger,
        maxBytes: 60,
        fetchImplementation: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(61));
                controller.close();
              },
            })
          ),
      });
      const tooLarge = await large.refresh();
      expect(tooLarge).toBeInstanceOf(ModelCatalogError);
      if (tooLarge instanceof ModelCatalogError)
        expect(tooLarge.reason).toBe("Catalog response is too large");
      const stalled = new ModelCatalogAdapter({
        store,
        logger,
        timeoutMs: 20,
        fetchImplementation: async () => new Promise<Response>(() => {}),
      });
      const timedOut = await stalled.refresh();
      expect(timedOut).toBeInstanceOf(ModelCatalogError);
      if (timedOut instanceof ModelCatalogError)
        expect(timedOut.reason).toBe("Catalog request timed out");
      expect(await store.read()).toBeNull();
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid responses without exposing payloads or replacing a good cache", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const { adapter } = fixture(dataDir, async () =>
        Response.json(upstream({ safe: model("safe") }))
      );
      const saved = await adapter.refresh();
      if (saved instanceof Error) throw saved;
      const invalid = fixture(
        dataDir,
        async () => new Response("secret-invalid-json")
      );
      const result = await invalid.adapter.refresh();
      expect(result).toBeInstanceOf(ModelCatalogError);
      expect(JSON.stringify(result)).not.toContain("secret-invalid-json");
      expect(await invalid.adapter.get()).toEqual(saved);
      const oversized = fixture(
        dataDir,
        async () =>
          new Response("{}", { headers: { "content-length": "999999999" } })
      );
      expect(await oversized.adapter.refresh()).toBeInstanceOf(
        ModelCatalogError
      );
      expect(await oversized.adapter.get()).toEqual(saved);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  test("reports filesystem replacement failure without claiming refresh succeeded", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-catalog-"));
    try {
      const { adapter } = fixture(dataDir, async () =>
        Response.json(upstream({ safe: model("safe") }))
      );
      await fs.rm(dataDir, { recursive: true });
      const result = await adapter.refresh();
      expect(result).toBeInstanceOf(ModelCatalogError);
      if (result instanceof ModelCatalogError)
        expect(result.reason).toBe("Catalog cache could not be saved");
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });
});
