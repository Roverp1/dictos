# @dictos/wasm-turso-sync

This package implements the `SyncPort` adapter for web browser environments using the `@tursodatabase/sync-wasm` client.

## Testing Strategy

This package does **not** implement the Shared Contract tests found in `@dictos/core`, and intentionally (unfortunately) contains no local integration tests.

**Why?**
The `@tursodatabase/sync-wasm` relies on browser APIs (like OPFS for storage).
We can't run these tests with Bun. And migration to vitest would slow down tests across the whole repo, or introduce too much complexity, and also probably won't add too much reliability.

Instead of forcing a browser-native adapter to run in a manually crafted server environment (which most likely be very different from browser) via Vitest, we rely on:

1. The `bun-turso-sync` adapter to prove our Drizzle schemas and core sync conflict logic are flawless.

To ensure both SyncPort adapters behave the same way, and to test their compatability with each other on sync, we should add e2e tests:

2. **End-to-End (E2E) Browser Tests** to verify this specific WASM adapter successfully replicates data in a real browser environment.
