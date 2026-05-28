import type { SyncPort } from "@ports/outbound";
import type { SyncError } from "@ports/outbound";

export class SyncService {
  constructor(private syncPort: SyncPort) {}

  async connect(url: string, token: string): Promise<void | SyncError> {
    return await this.syncPort.connectRemote(url, token);
  }

  async sync(): Promise<void | SyncError> {
    return await this.syncPort.sync();
  }

  async disconnect(): Promise<void | SyncError> {
    return await this.syncPort.disconnectRemote();
  }
}
