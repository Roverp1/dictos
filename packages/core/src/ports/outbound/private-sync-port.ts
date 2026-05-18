import type { SyncError } from "errors";

export interface SyncSummary {
  pulled: number;
  pushed: number;
}

export interface PrivateSyncPort {
  triggerPrivateSync(): Promise<SyncSummary | SyncError>;
}
