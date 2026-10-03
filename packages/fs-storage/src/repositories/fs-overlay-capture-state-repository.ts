import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { descriptionTypes, StorageError } from "@dictos/core";
import * as errore from "@dictos/errore";

import {
  emptyOverlayCaptureState,
  type OverlayCaptureLocalState,
  type OverlayCaptureStateStore,
} from "../overlay-capture-state";

function failure(operation: string, reason: string, cause?: unknown) {
  return new StorageError({
    operation,
    reason,
    ...(cause === undefined ? {} : { cause }),
  });
}

function isMissing(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function validState(value: unknown): value is OverlayCaptureLocalState {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  if (!("version" in value) || value.version !== 1) return false;
  if (
    !("instructionText" in value) ||
    typeof value.instructionText !== "string"
  )
    return false;
  if (!("selectedTypes" in value) || !Array.isArray(value.selectedTypes))
    return false;
  return value.selectedTypes.every((type: unknown) =>
    descriptionTypes.some((valid) => valid === type)
  );
}

export class FsOverlayCaptureStateRepository implements OverlayCaptureStateStore {
  private readonly directory: string;
  private readonly file: string;
  private pending: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.directory = path.join(dataDir, "overlay-capture");
    this.file = path.join(this.directory, "state.json");
  }

  async read(): Promise<OverlayCaptureLocalState | StorageError> {
    const raw = await fs
      .readFile(this.file, "utf8")
      .catch((cause: unknown) =>
        isMissing(cause)
          ? null
          : failure("read_overlay_state", "Could not read state", cause)
      );
    if (raw instanceof Error) return raw;
    if (raw === null) return emptyOverlayCaptureState();

    const parsed = errore.try(
      () => JSON.parse(raw) as unknown,
      (cause) => failure("parse_overlay_state", "Invalid JSON", cause)
    );
    if (StorageError.is(parsed)) return parsed;
    if (!validState(parsed))
      return failure("parse_overlay_state", "Invalid state");
    return {
      version: 1,
      instructionText: parsed.instructionText,
      selectedTypes: parsed.selectedTypes,
    };
  }

  async replace(
    state: OverlayCaptureLocalState
  ): Promise<OverlayCaptureLocalState | StorageError> {
    if (!validState(state))
      return failure("replace_overlay_state", "Invalid state");
    const snapshot: OverlayCaptureLocalState = {
      version: 1,
      instructionText: state.instructionText,
      selectedTypes: [...state.selectedTypes],
    };
    // Complete snapshots need call ordering here; atomic rename arbitrates across processes.
    const result = this.pending.then(() => this.writeSnapshot(snapshot));
    this.pending = result.then(() => undefined);
    return result;
  }

  private async writeSnapshot(saved: OverlayCaptureLocalState) {
    const created = await fs
      .mkdir(this.directory, { recursive: true, mode: 0o700 })
      .catch((cause: unknown) =>
        failure(
          "replace_overlay_state",
          "Could not create state directory",
          cause
        )
      );
    if (created instanceof Error) return created;

    const current = await this.read();
    if (current instanceof Error) return current;

    const temporary = `${this.file}.${randomUUID()}.tmp`;
    const written = await fs
      .writeFile(temporary, JSON.stringify(saved), { flag: "wx", mode: 0o600 })
      .catch((cause: unknown) =>
        failure("write_overlay_state", "Could not write state", cause)
      );
    if (written instanceof Error) {
      const cleaned = await this.cleanup(temporary);
      return cleaned instanceof Error ? cleaned : written;
    }
    const renamed = await fs
      .rename(temporary, this.file)
      .catch((cause: unknown) =>
        failure("write_overlay_state", "Could not replace state", cause)
      );
    if (renamed instanceof Error) {
      const cleaned = await this.cleanup(temporary);
      return cleaned instanceof Error ? cleaned : renamed;
    }
    return saved;
  }

  private async cleanup(temporary: string) {
    return fs
      .rm(temporary, { force: true })
      .catch((cause: unknown) =>
        failure(
          "write_overlay_state",
          "Could not clean up temporary state",
          cause
        )
      );
  }
}
