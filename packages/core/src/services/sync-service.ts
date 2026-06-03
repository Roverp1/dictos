import type { SyncPort, SyncResult } from "@ports/outbound";
import type { ConnectivityPort } from "@ports/outbound/connectivity-port";
import { OfflineError, type SyncError } from "errors";

export class SyncService {
  constructor(
    private syncPort: SyncPort,
    private connectivityPort: ConnectivityPort
  ) {}

  async connect(
    url: string,
    token: string
  ): Promise<void | SyncError | OfflineError> {
    const isOnline = await this.connectivityPort.isOnline();
    if (!isOnline) {
      return new OfflineError();
    }
    return await this.syncPort.connectRemote(url, token);
  }

  async sync(): Promise<SyncResult | SyncError | OfflineError> {
    const isOnline = await this.connectivityPort.isOnline();
    if (!isOnline) {
      return new OfflineError();
    }
    return await this.syncPort.sync();
  }

  async disconnect(): Promise<void | SyncError> {
    return await this.syncPort.disconnectRemote();
  }
}
