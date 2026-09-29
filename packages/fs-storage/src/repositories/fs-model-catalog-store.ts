import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "@dictos/errore";

import {
  StorageError,
  parseQualifiedModelId,
  type ModelCatalog,
  type ModelCatalogStore,
} from "@dictos/core";

type CacheFile = Omit<ModelCatalog, "source"> & { version: 1 };

export class FsModelCatalogStore implements ModelCatalogStore {
  private readonly filePath: string;

  constructor({ dataDir }: { dataDir: string }) {
    this.filePath = path.join(dataDir, "model-catalog.json");
  }

  async read(): Promise<ModelCatalog | StorageError | null> {
    const raw = await fs
      .readFile(this.filePath, "utf8")
      .catch((cause: unknown) => {
        if (isNotFound(cause)) return null;
        return new StorageError({
          operation: "read_model_catalog",
          reason: "Could not read Model Catalog cache",
          cause,
        });
      });
    if (raw instanceof Error) return raw;
    if (raw === null) return null;

    const parsed = errore.try(
      () => JSON.parse(raw) as unknown,
      () =>
        new StorageError({
          operation: "parse_model_catalog",
          reason: "Model Catalog cache contains invalid JSON",
        })
    );
    if (parsed instanceof StorageError) return parsed;
    if (!isCacheFile(parsed))
      return new StorageError({
        operation: "validate_model_catalog",
        reason: "Model Catalog cache has invalid data",
      });

    // Copy only validated fields; never expose extra fields from a downloaded cache.
    return {
      source: "cache",
      fetchedAt: parsed.fetchedAt,
      providers: parsed.providers.map(({ id, name }) => ({ id, name })),
      models: parsed.models.map((model) => ({
        providerId: model.providerId,
        modelId: model.modelId,
        name: model.name,
        status: model.status,
        inputModalities: [...model.inputModalities],
        outputModalities: [...model.outputModalities],
        ...(model.cost === undefined ? {} : { cost: { ...model.cost } }),
        ...(model.protocol === undefined ? {} : { protocol: model.protocol }),
      })),
    };
  }

  async replace(catalog: ModelCatalog): Promise<void | StorageError> {
    if (catalog.source !== "cache" && catalog.source !== "bundled")
      return new StorageError({
        operation: "validate_model_catalog",
        reason: "Model Catalog cache has invalid data",
      });
    const file: CacheFile = {
      version: 1,
      fetchedAt: catalog.fetchedAt,
      providers: catalog.providers,
      models: catalog.models,
    };
    if (!isCacheFile(file))
      return new StorageError({
        operation: "validate_model_catalog",
        reason: "Model Catalog cache has invalid data",
      });

    const payload: CacheFile = {
      version: 1,
      fetchedAt: file.fetchedAt,
      providers: file.providers.map(({ id, name }) => ({ id, name })),
      models: file.models.map((model) => ({
        providerId: model.providerId,
        modelId: model.modelId,
        name: model.name,
        status: model.status,
        inputModalities: [...model.inputModalities],
        outputModalities: [...model.outputModalities],
        ...(model.cost === undefined
          ? {}
          : { cost: { input: model.cost.input, output: model.cost.output } }),
        ...(model.protocol === undefined ? {} : { protocol: model.protocol }),
      })),
    };
    const temporaryPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    const written = await fs
      .writeFile(temporaryPath, JSON.stringify(payload), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      })
      .catch(
        (cause) =>
          new StorageError({
            operation: "write_model_catalog",
            reason: "Could not write Model Catalog cache",
            cause,
          })
      );
    if (written instanceof Error) {
      const cleaned = await this.removeTemporaryFile(temporaryPath);
      return cleaned instanceof Error ? cleaned : written;
    }

    const replaced = await fs.rename(temporaryPath, this.filePath).catch(
      (cause) =>
        new StorageError({
          operation: "replace_model_catalog",
          reason: "Could not replace Model Catalog cache",
          cause,
        })
    );
    if (replaced instanceof Error) {
      const cleaned = await this.removeTemporaryFile(temporaryPath);
      return cleaned instanceof Error ? cleaned : replaced;
    }
  }

  private async removeTemporaryFile(
    filePath: string
  ): Promise<void | StorageError> {
    return fs.rm(filePath, { force: true }).catch(
      (cause) =>
        new StorageError({
          operation: "cleanup_model_catalog",
          reason: "Could not remove temporary Model Catalog cache",
          cause,
        })
    );
  }
}

function isCacheFile(value: unknown): value is CacheFile {
  if (!isRecord(value) || value.version !== 1) return false;
  if (
    typeof value.fetchedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.fetchedAt) ||
    !Number.isFinite(Date.parse(value.fetchedAt)) ||
    !Array.isArray(value.providers) ||
    !Array.isArray(value.models)
  )
    return false;

  const providerIds = new Set<string>();
  for (const provider of value.providers) {
    if (
      !isRecord(provider) ||
      typeof provider.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider.id) ||
      !isSafeText(provider.name) ||
      providerIds.has(provider.id)
    )
      return false;
    providerIds.add(provider.id);
  }

  const modelIds = new Set<string>();
  for (const model of value.models) {
    if (
      !isRecord(model) ||
      typeof model.providerId !== "string" ||
      !providerIds.has(model.providerId) ||
      typeof model.modelId !== "string" ||
      !isSafeText(model.modelId) ||
      model.modelId.trim() !== model.modelId ||
      parseQualifiedModelId(`${model.providerId}/${model.modelId}`) instanceof
        Error ||
      !isSafeText(model.name) ||
      !["active", "alpha", "beta"].includes(model.status as string) ||
      !Array.isArray(model.inputModalities) ||
      !model.inputModalities.every(isSafeText) ||
      !Array.isArray(model.outputModalities) ||
      !model.outputModalities.every(isSafeText) ||
      (model.protocol !== undefined && !isSafeText(model.protocol)) ||
      (model.cost !== undefined &&
        (!isRecord(model.cost) ||
          !isCost(model.cost.input) ||
          !isCost(model.cost.output)))
    )
      return false;
    const id = `${model.providerId}/${model.modelId}`;
    if (modelIds.has(id)) return false;
    modelIds.add(id);
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
  );
}

function isCost(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNotFound(cause: unknown): boolean {
  return isRecord(cause) && cause.code === "ENOENT";
}
