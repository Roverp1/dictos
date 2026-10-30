// Only external Provider HTTP is redirected; the CLI keeps its real composition root.
const endpoint = process.env.DICTOS_TEST_PROVIDER_ENDPOINT;
const nativeFetch = globalThis.fetch;
if (endpoint) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const upstream = input instanceof Request ? input.url : String(input);
    const target = new URL(endpoint);
    target.searchParams.set("upstream", upstream);
    return nativeFetch(target, init);
  }) as typeof fetch;
}
