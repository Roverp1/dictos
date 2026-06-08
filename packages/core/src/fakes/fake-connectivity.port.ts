import type { ConnectivityPort } from "../ports/outbound";

export class FakeConnectivityPort implements ConnectivityPort {
  public simulateOffline = false;

  async isOnline(): Promise<boolean> {
    return !this.simulateOffline;
  }
}
