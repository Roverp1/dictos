import * as errore from "errore";
import {
  ModelCatalogError,
  type CatalogModel,
  type ModelCatalog,
  type ModelCatalogPort,
  type ModelCatalogStore,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

import snapshot from "./models-dev-snapshot.json";

const URL = "https://models.dev/api.json";
const PROVIDERS = ["deepseek", "google", "groq", "openai", "openrouter"];
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const safeText = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 200 &&
  !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const ordered = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const fail = (operation: string, reason: string, cause?: Error) =>
  new ModelCatalogError({ operation, reason, cause });

function normalize(
  value: unknown,
  source: ModelCatalog["source"]
): ModelCatalog | ModelCatalogError {
  if (
    !record(value) ||
    !safeText(value.fetchedAt) ||
    !Number.isFinite(Date.parse(value.fetchedAt)) ||
    !Array.isArray(value.providers) ||
    !Array.isArray(value.models)
  )
    return fail("validate", "Catalog data is invalid");

  const providers: ModelCatalog["providers"] = [];
  for (const item of value.providers) {
    if (
      !record(item) ||
      !PROVIDERS.includes(item.id as string) ||
      !safeText(item.name) ||
      providers.some((provider) => provider.id === item.id)
    )
      return fail("validate", "Catalog provider is invalid");
    providers.push({ id: item.id as string, name: item.name });
  }
  if (!providers.length)
    return fail("validate", "Catalog has no supported providers");
  // A partial upstream response must not make a supported connection unmanageable.
  for (const bundled of snapshot.providers) {
    if (!providers.some((provider) => provider.id === bundled.id))
      providers.push({ id: bundled.id, name: bundled.name });
  }

  const models: CatalogModel[] = [];
  for (const item of value.models) {
    if (
      !record(item) ||
      !providers.some((provider) => provider.id === item.providerId) ||
      !safeText(item.modelId) ||
      item.modelId.trim() !== item.modelId ||
      !safeText(item.name) ||
      item.textGeneration !== true ||
      !["active", "alpha", "beta"].includes(item.status as string) ||
      !Array.isArray(item.inputModalities) ||
      !item.inputModalities.every(safeText) ||
      !Array.isArray(item.outputModalities) ||
      !item.outputModalities.every(safeText) ||
      !item.inputModalities.includes("text") ||
      item.outputModalities.length !== 1 ||
      item.outputModalities[0] !== "text" ||
      item.protocol !== undefined ||
      (item.cost !== undefined &&
        (!record(item.cost) ||
          typeof item.cost.input !== "number" ||
          !Number.isFinite(item.cost.input) ||
          item.cost.input < 0 ||
          typeof item.cost.output !== "number" ||
          !Number.isFinite(item.cost.output) ||
          item.cost.output < 0)) ||
      models.some(
        (model) =>
          model.providerId === item.providerId && model.modelId === item.modelId
      )
    )
      return fail("validate", "Catalog Model is invalid");
    models.push({
      providerId: item.providerId as string,
      modelId: item.modelId,
      name: item.name,
      textGeneration: true,
      status: item.status as CatalogModel["status"],
      inputModalities: item.inputModalities,
      outputModalities: item.outputModalities,
      ...(item.cost === undefined
        ? {}
        : {
            cost: {
              input: (item.cost as { input: number }).input,
              output: (item.cost as { output: number }).output,
            },
          }),
    });
  }
  if (!models.length) return fail("validate", "Catalog has no eligible Models");
  providers.sort((a, b) => ordered(a.id, b.id));
  models.sort(
    (a, b) =>
      ordered(a.providerId, b.providerId) || ordered(a.modelId, b.modelId)
  );
  return { source, fetchedAt: value.fetchedAt, providers, models };
}

function fromUpstream(value: unknown): ModelCatalog | ModelCatalogError {
  if (!record(value)) return fail("validate", "Catalog response is invalid");
  const providers: ModelCatalog["providers"] = [];
  const models: CatalogModel[] = [];
  for (const id of PROVIDERS) {
    const provider = value[id];
    if (
      !record(provider) ||
      provider.id !== id ||
      !safeText(provider.name) ||
      !record(provider.models)
    )
      continue;
    providers.push({ id, name: provider.name });
    for (const [modelId, candidate] of Object.entries(provider.models)) {
      if (
        !record(candidate) ||
        candidate.id !== modelId ||
        !safeText(modelId) ||
        modelId.trim() !== modelId ||
        !safeText(candidate.name) ||
        ![undefined, "active", "alpha", "beta"].includes(
          candidate.status as string | undefined
        ) ||
        candidate.provider !== undefined ||
        !record(candidate.modalities) ||
        !Array.isArray(candidate.modalities.input) ||
        !candidate.modalities.input.every(safeText) ||
        !candidate.modalities.input.includes("text") ||
        !Array.isArray(candidate.modalities.output) ||
        candidate.modalities.output.length !== 1 ||
        candidate.modalities.output[0] !== "text" ||
        !(
          candidate.temperature === true ||
          candidate.tool_call === true ||
          candidate.structured_output === true
        )
      )
        continue;
      const cost = candidate.cost;
      const price =
        record(cost) &&
        typeof cost.input === "number" &&
        Number.isFinite(cost.input) &&
        cost.input >= 0 &&
        typeof cost.output === "number" &&
        Number.isFinite(cost.output) &&
        cost.output >= 0
          ? { cost: { input: cost.input, output: cost.output } }
          : {};
      models.push({
        providerId: id,
        modelId,
        name: candidate.name,
        textGeneration: true,
        status: (candidate.status ?? "active") as CatalogModel["status"],
        inputModalities: candidate.modalities.input,
        outputModalities: candidate.modalities.output,
        ...price,
      });
    }
  }
  if (!models.length)
    return fail("validate", "Catalog response has no eligible Models");
  return normalize(
    { fetchedAt: new Date().toISOString(), providers, models },
    "cache"
  );
}

type Fetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => ReturnType<typeof fetch>;

export class ModelCatalogAdapter implements ModelCatalogPort {
  constructor(
    private readonly options: {
      store: ModelCatalogStore;
      logger: Logger;
      fetchImplementation: Fetch;
      timeoutMs?: number;
      maxBytes?: number;
    }
  ) {}

  async get(): Promise<ModelCatalog | ModelCatalogError> {
    const cached = await this.options.store
      .read()
      .catch(() =>
        fail(
          "read",
          "Catalog cache is unavailable",
          new Error("Catalog cache is unavailable")
        )
      );
    if (cached !== null && !(cached instanceof Error)) {
      const valid = normalize(cached, "cache");
      if (!(valid instanceof Error)) return valid;
    }
    if (cached instanceof Error || cached !== null)
      this.options.logger.warn(
        "Model Catalog cache invalid; using bundled catalog",
        { source: "cache" }
      );
    return normalize(snapshot, "bundled");
  }

  async refresh(): Promise<ModelCatalog | ModelCatalogError> {
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? TIMEOUT_MS;
    const maxBytes = this.options.maxBytes ?? MAX_BYTES;
    const timeout = fail("refresh", "Catalog request timed out");
    const deadline = Promise.withResolvers<ModelCatalogError>();
    const timer = setTimeout(() => {
      controller.abort();
      deadline.resolve(timeout);
    }, timeoutMs);
    const request = async (): Promise<ModelCatalog | ModelCatalogError> => {
      const response = await Promise.resolve()
        .then(() =>
          this.options.fetchImplementation(URL, { signal: controller.signal })
        )
        .catch(() =>
          fail(
            "refresh",
            "Catalog request failed",
            new Error("Catalog request failed")
          )
        );
      if (response instanceof Error) return response;
      if (!response.ok) return fail("refresh", "Catalog request failed");
      if (Number(response.headers.get("content-length")) > maxBytes)
        return fail("refresh", "Catalog response is too large");
      if (!response.body) return fail("refresh", "Catalog response is empty");
      const reader = errore.try(() => response.body!.getReader());
      if (reader instanceof Error)
        return fail("refresh", "Catalog response could not be read");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader
          .read()
          .catch(() =>
            fail(
              "refresh",
              "Catalog response could not be read",
              new Error("Catalog response could not be read")
            )
          );
        if (part instanceof Error) return part;
        if (part.done) break;
        size += part.value.byteLength;
        if (size > maxBytes) {
          controller.abort();
          return fail("refresh", "Catalog response is too large");
        }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const decoded = errore.try(() =>
        new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      );
      if (decoded instanceof Error)
        return fail("refresh", "Catalog response is invalid");
      const parsed = errore.try(() => JSON.parse(decoded) as unknown);
      if (parsed instanceof Error)
        return fail("refresh", "Catalog response is invalid");
      const catalog = fromUpstream(parsed);
      if (catalog instanceof Error) return catalog;
      return catalog;
    };
    const result = await Promise.race([request(), deadline.promise]);
    clearTimeout(timer);
    if (result instanceof Error) return result;
    if (controller.signal.aborted) return timeout;
    // A filesystem replacement cannot be cancelled once started; await its outcome.
    const stored = await this.options.store
      .replace(result)
      .catch(() =>
        fail(
          "refresh",
          "Catalog cache could not be saved",
          new Error("Catalog cache could not be saved")
        )
      );
    if (stored instanceof Error)
      return fail(
        "refresh",
        "Catalog cache could not be saved",
        new Error("Catalog cache could not be saved")
      );
    return result;
  }
}
