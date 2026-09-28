# @dictos/wasm-turso-sync

This package implements the `SyncPort` adapter for web browser environments using the `@tursodatabase/sync-wasm` client.

## Testing Strategy

This package intentionally does **not** bind the shared contracts from `@dictos/core/testing` or `@dictos/db-core/testing`, and contains no package-local integration runner.

**Why?**

`@tursodatabase/sync-wasm` depends on browser APIs such as OPFS. A package-local Vitest/Playwright setup would duplicate the application's browser harness, add heavy dependencies, and still provide a weaker environment than a real cross-platform flow.

Verification is split by responsibility:

1. `@dictos/bun-turso-sync` runs the shared domain-port and SQLite schema contracts against a real local Turso database.
2. Cross-platform browser E2E tests own WASM migration, OPFS persistence, and Bun/WASM replication compatibility.

Do not add Vitest, Playwright, browser binaries, or a local `test` script to this package without first changing this documented strategy.
