import * as errore from "errore";

export class SyncError extends errore.createTaggedError({
  name: "SyncError",
  message: "Failed to sync with remote database: $reason",
}) {}

export interface SyncPort {
  /**
   * Connects the local database to the remote cloud database.
   * This shoud be called on app startup if credentials exist.
   */
  connectRemote(url: string, token: string): Promise<void | SyncError>;

  /**
   * Pushes local changes to the remote database and pulls down new changes.
   */
  sync(): Promise<void | SyncError>;

  /**
   * Disconnects the local database from the remote cloud database.
   */
  disconnectRemote(): Promise<void | SyncError>;
}
