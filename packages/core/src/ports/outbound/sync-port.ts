import { SyncError } from "../../errors";

export interface SyncResult {
  /** will be true after push */
  pulledRemoteChanges: boolean;
  pushedLocalChanges: boolean;
  stats: { bytesSent: number; bytesReceived: number; operationsSynced: number };
}

export interface SyncPort {
  /**
   * Connects the local database to the remote cloud database.
   * This shoud be called on app startup if credentials exist.
   */
  connectRemote(url: string, token: string): Promise<void | SyncError>;

  /**
   * Pushes local changes to the remote database and pulls down new changes.
   */
  sync(): Promise<SyncResult | SyncError>;

  /**
   * Disconnects the local database from the remote cloud database.
   */
  disconnectRemote(): Promise<void | SyncError>;
}
