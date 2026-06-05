import type { ConnectivityPort } from "@dictos/core";

export class HttpConnectivityAdapter implements ConnectivityPort {
  constructor(private url: string) {}

  async isOnline(): Promise<boolean> {
    const response = await fetch(this.url, {
      method: "HEAD",
      signal: AbortSignal.timeout(1500),
    })
      .then((res) => res.ok)
      .catch(() => false);

    return response;
  }
}
