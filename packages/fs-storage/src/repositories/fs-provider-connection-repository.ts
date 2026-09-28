import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";

import {
  StorageError,
  type NewProviderConnection,
  type ProviderConnection,
  type ProviderConnectionRepository,
  type ProviderConnectionWithCredential,
} from "@dictos/core";

type ProviderConnectionFile = {
  connections: ProviderConnectionWithCredential[];
};

export class FsProviderConnectionRepository implements ProviderConnectionRepository {
  private filePath: string;
  private logger: Logger;

  constructor({ dataDir, logger }: { dataDir: string; logger: Logger }) {
    this.filePath = path.join(dataDir, "providers.json");
    this.logger = logger;
  }

  async save(
    input: NewProviderConnection
  ): Promise<ProviderConnection | StorageError> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    const connection: ProviderConnectionWithCredential = {
      id: crypto.randomUUID(),
      ...input,
    };
    const saved = await this.writeFile({
      connections: [...file.connections, connection],
    });
    if (saved instanceof Error) return saved;
    this.logger.info("Provider Connection saved", {
      providerConnectionId: connection.id,
      presetId: connection.presetId,
    });
    return redact(connection);
  }

  async findById(
    id: string
  ): Promise<ProviderConnectionWithCredential | StorageError | null> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    return file.connections.find((connection) => connection.id === id) ?? null;
  }

  async findAll(): Promise<ProviderConnection[] | StorageError> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    return file.connections.map(redact);
  }

  async update(
    id: string,
    input: Partial<Omit<NewProviderConnection, "presetId">> & {
      presetId?: string | null;
    }
  ): Promise<ProviderConnection | StorageError> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    const existing = file.connections.find(
      (connection) => connection.id === id
    );
    if (!existing) {
      const error = new StorageError({
        operation: "update_provider_connection",
        reason: "Provider Connection not found",
      });
      this.logger.error("Provider Connection update failed", error, {
        providerConnectionId: id,
      });
      return error;
    }
    const updated = { ...existing, ...input };
    const saved = await this.writeFile({
      connections: file.connections.map((connection) =>
        connection.id === id ? updated : connection
      ),
    });
    if (saved instanceof Error) return saved;
    this.logger.info("Provider Connection updated", {
      providerConnectionId: id,
      presetId: updated.presetId,
    });
    return redact(updated);
  }

  async delete(id: string): Promise<ProviderConnection | StorageError> {
    const file = await this.readFile();
    if (file instanceof Error) return file;
    const existing = file.connections.find(
      (connection) => connection.id === id
    );
    if (!existing) {
      const error = new StorageError({
        operation: "delete_provider_connection",
        reason: "Provider Connection not found",
      });
      this.logger.error("Provider Connection deletion failed", error, {
        providerConnectionId: id,
      });
      return error;
    }
    const saved = await this.writeFile({
      connections: file.connections.filter(
        (connection) => connection.id !== id
      ),
    });
    if (saved instanceof Error) return saved;
    this.logger.info("Provider Connection deleted", {
      providerConnectionId: id,
      presetId: existing.presetId,
    });
    return redact(existing);
  }

  private async readFile(): Promise<ProviderConnectionFile | StorageError> {
    const raw = await fs
      .readFile(this.filePath, "utf8")
      .catch((cause: unknown) => {
        if (isNotFound(cause)) return null;
        return new StorageError({
          operation: "read_provider_connections",
          reason: "Could not read provider storage",
          cause,
        });
      });
    if (raw instanceof Error) {
      this.logReadError(raw);
      return raw;
    }
    if (raw === null) return { connections: [] };
    const parsed = errore.try(
      () => JSON.parse(raw) as unknown,
      (_cause) =>
        new StorageError({
          operation: "parse_provider_connections",
          reason: "Provider storage contains invalid JSON",
          cause: new Error("Provider storage JSON could not be parsed"),
        })
    );
    if (parsed instanceof StorageError) {
      this.logReadError(parsed);
      return parsed;
    }
    if (!isConnectionFile(parsed)) {
      const error = new StorageError({
        operation: "validate_provider_connections",
        reason: "Provider storage has an invalid shape",
      });
      this.logReadError(error);
      return error;
    }
    return parsed;
  }

  private async writeFile(
    file: ProviderConnectionFile
  ): Promise<void | StorageError> {
    const temporaryPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    const writeResult = await fs
      .writeFile(temporaryPath, JSON.stringify(file), {
        encoding: "utf8",
        mode: 0o600,
      })
      .catch(
        (cause) =>
          new StorageError({
            operation: "write_provider_connections",
            reason: "Could not write provider storage",
            cause,
          })
      );
    if (writeResult instanceof Error) {
      this.logWriteError(writeResult);
      await this.removeTemporaryFile(temporaryPath);
      return writeResult;
    }
    const renameResult = await fs.rename(temporaryPath, this.filePath).catch(
      (cause) =>
        new StorageError({
          operation: "replace_provider_connections",
          reason: "Could not replace provider storage",
          cause,
        })
    );
    if (renameResult instanceof Error) {
      this.logWriteError(renameResult);
      await this.removeTemporaryFile(temporaryPath);
      return renameResult;
    }
    const permissions = await fs.chmod(this.filePath, 0o600).catch(
      (cause) =>
        new StorageError({
          operation: "secure_provider_connections",
          reason: "Could not secure provider storage",
          cause,
        })
    );
    if (permissions instanceof Error) {
      this.logWriteError(permissions);
      return permissions;
    }
  }

  private logReadError(error: StorageError): void {
    this.logger.error("Provider Connection storage read failed", error, {
      operation: error.operation,
    });
  }

  private logWriteError(error: StorageError): void {
    this.logger.error("Provider Connection storage write failed", error, {
      operation: error.operation,
    });
  }

  private async removeTemporaryFile(temporaryPath: string): Promise<void> {
    const result = await fs.rm(temporaryPath, { force: true }).catch(
      (cause) =>
        new StorageError({
          operation: "cleanup_provider_connection_temporary_file",
          reason: "Could not remove temporary provider storage",
          cause,
        })
    );
    if (!(result instanceof Error)) return;
    this.logger.error(
      "Provider Connection temporary file cleanup failed",
      result,
      { operation: result.operation }
    );
  }
}

function redact(
  connection: ProviderConnectionWithCredential
): ProviderConnection {
  return {
    id: connection.id,
    name: connection.name,
    presetId: connection.presetId,
    baseUrl: connection.baseUrl,
  };
}

function isConnectionFile(value: unknown): value is ProviderConnectionFile {
  if (
    !value ||
    typeof value !== "object" ||
    !("connections" in value) ||
    !Array.isArray(value.connections)
  )
    return false;
  return value.connections.every(
    (connection) =>
      connection &&
      typeof connection === "object" &&
      "id" in connection &&
      typeof connection.id === "string" &&
      "name" in connection &&
      typeof connection.name === "string" &&
      "presetId" in connection &&
      (typeof connection.presetId === "string" ||
        connection.presetId === null) &&
      "baseUrl" in connection &&
      typeof connection.baseUrl === "string" &&
      "apiKey" in connection &&
      typeof connection.apiKey === "string"
  );
}

function isNotFound(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}
