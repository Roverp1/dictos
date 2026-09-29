import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";
import {
  StorageError,
  ValidationError,
  type ProviderConnection,
  type ProviderConnectionRepository,
  type ProviderConnectionWithCredential,
  type ProviderId,
} from "@dictos/core";

type ProviderConnectionFile = {
  version: 1;
  connections: Record<ProviderId, { apiKey: string }>;
};

const emptyFile = (): ProviderConnectionFile => ({
  version: 1,
  connections: {},
});
const validId = (id: string) =>
  typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const validKey = (key: string) =>
  typeof key === "string" && key.trim().length > 0;

function storageError(operation: string, reason: string, cause?: unknown) {
  // Filesystem/JSON exception messages can contain raw file contents or secret-bearing paths.
  return new StorageError({
    operation,
    reason,
    ...(cause === undefined ? {} : { cause: new Error(reason) }),
  });
}

function isNotFound(cause: unknown) {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}

function isConnectionFile(value: unknown): value is ProviderConnectionFile {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  if (Object.keys(value).length !== 2) return false;
  if (!("version" in value) || value.version !== 1 || !("connections" in value))
    return false;
  const connections = value.connections;
  if (
    typeof connections !== "object" ||
    connections === null ||
    Array.isArray(connections)
  )
    return false;
  return Object.entries(connections).every(
    ([id, entry]) =>
      validId(id) &&
      typeof entry === "object" &&
      entry !== null &&
      !Array.isArray(entry) &&
      Object.keys(entry).length === 1 &&
      "apiKey" in entry &&
      validKey(entry.apiKey as string)
  );
}

export class FsProviderConnectionRepository implements ProviderConnectionRepository {
  private readonly filePath: string;
  private readonly logger: Logger;

  constructor({ dataDir, logger }: { dataDir: string; logger: Logger }) {
    this.filePath = path.join(dataDir, "providers.json");
    this.logger = logger;
  }

  async create(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | ValidationError | StorageError> {
    if (!validId(input.providerId) || !validKey(input.apiKey))
      return new ValidationError({ reason: "Invalid Provider ID or API key" });
    const result = await this.mutate((file) => {
      if (Object.hasOwn(file.connections, input.providerId))
        return new ValidationError({
          reason: "Provider Connection already exists",
        });
      file.connections[input.providerId] = { apiKey: input.apiKey };
      return { providerId: input.providerId };
    });
    return (
      result ??
      storageError(
        "create_provider_connection",
        "Could not create Provider Connection"
      )
    );
  }

  async findByProviderId(
    providerId: ProviderId
  ): Promise<ProviderConnectionWithCredential | StorageError | null> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    const entry = Object.hasOwn(file.connections, providerId)
      ? file.connections[providerId]
      : null;
    return entry ? { providerId, apiKey: entry.apiKey } : null;
  }

  async findAll(): Promise<ProviderConnection[] | StorageError> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    return Object.keys(file.connections)
      .sort()
      .map((providerId) => ({ providerId }));
  }

  async replaceKey(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | StorageError | null> {
    if (!validId(input.providerId) || !validKey(input.apiKey))
      return storageError(
        "replace_provider_connection",
        "Invalid Provider ID or API key"
      );
    const result = await this.mutate((file) => {
      if (!Object.hasOwn(file.connections, input.providerId)) return null;
      file.connections[input.providerId] = { apiKey: input.apiKey };
      return { providerId: input.providerId };
    });
    return result instanceof ValidationError
      ? storageError(
          "replace_provider_connection",
          "Invalid Provider Connection"
        )
      : result;
  }

  async delete(
    providerId: ProviderId
  ): Promise<ProviderConnection | StorageError | null> {
    if (!validId(providerId))
      return storageError("delete_provider_connection", "Invalid Provider ID");
    const result = await this.mutate((file) => {
      if (!Object.hasOwn(file.connections, providerId)) return null;
      delete file.connections[providerId];
      return { providerId };
    });
    return result instanceof ValidationError
      ? storageError(
          "delete_provider_connection",
          "Invalid Provider Connection"
        )
      : result;
  }

  private async mutate(
    change: (
      file: ProviderConnectionFile
    ) => ProviderConnection | ValidationError | null
  ): Promise<ProviderConnection | ValidationError | StorageError | null> {
    const lockPath = `${this.filePath}.lock`;
    const deadline = Date.now() + 1500;
    while (true) {
      const acquired = await fs
        .mkdir(lockPath, { mode: 0o700 })
        .catch((cause: unknown) => cause);
      if (acquired === undefined) break;
      if (
        typeof acquired !== "object" ||
        acquired === null ||
        !("code" in acquired) ||
        acquired.code !== "EEXIST"
      )
        return storageError(
          "lock_provider_connections",
          "Could not lock provider storage",
          acquired
        );
      if (Date.now() >= deadline)
        return storageError(
          "lock_provider_connections",
          "Provider storage is busy"
        );
      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    const result = await this.mutateLocked(change);
    const released = await fs
      .rmdir(lockPath)
      .catch((cause: unknown) =>
        storageError(
          "unlock_provider_connections",
          "Could not unlock provider storage",
          cause
        )
      );
    if (released instanceof Error) return released;
    return result;
  }

  private async mutateLocked(
    change: (
      file: ProviderConnectionFile
    ) => ProviderConnection | ValidationError | null
  ): Promise<ProviderConnection | ValidationError | StorageError | null> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    const result = change(file);
    if (result instanceof Error || result === null) return result;
    const saved = await this.writeFile(file);
    if (saved instanceof Error) return saved;
    return result;
  }

  private async readFile(): Promise<ProviderConnectionFile | StorageError> {
    const raw = await fs
      .readFile(this.filePath, "utf8")
      .catch((cause: unknown) =>
        isNotFound(cause)
          ? null
          : storageError(
              "read_provider_connections",
              "Could not read provider storage",
              cause
            )
      );
    if (raw instanceof Error) return raw;
    if (raw === null) return emptyFile();
    const parsed = errore.try(
      () => JSON.parse(raw) as unknown,
      (cause) =>
        storageError(
          "parse_provider_connections",
          "Provider storage contains invalid JSON",
          cause
        )
    );
    if (StorageError.is(parsed)) return parsed;
    if (!isConnectionFile(parsed))
      return storageError(
        "validate_provider_connections",
        "Provider storage has an invalid shape"
      );
    return parsed;
  }

  private async writeFile(
    file: ProviderConnectionFile
  ): Promise<void | StorageError> {
    const temporaryPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    const written = await fs
      .writeFile(temporaryPath, JSON.stringify(file), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      })
      .catch((cause: unknown) =>
        storageError(
          "write_provider_connections",
          "Could not write provider storage",
          cause
        )
      );
    if (written instanceof Error) {
      await this.cleanup(temporaryPath);
      return written;
    }
    const renamed = await fs
      .rename(temporaryPath, this.filePath)
      .catch((cause: unknown) =>
        storageError(
          "replace_provider_connections",
          "Could not replace provider storage",
          cause
        )
      );
    if (renamed instanceof Error) {
      await this.cleanup(temporaryPath);
      return renamed;
    }
    // The temporary file is created owner-only; rename never exposes an insecure final file.
  }

  private async cleanup(temporaryPath: string) {
    const removed = await fs
      .rm(temporaryPath, { force: true })
      .catch((cause: unknown) =>
        storageError(
          "cleanup_provider_connections",
          "Could not clean up provider storage",
          cause
        )
      );
    if (removed instanceof Error)
      this.logger.error("Provider storage cleanup failed", removed, {
        operation: removed.operation,
      });
  }
}
