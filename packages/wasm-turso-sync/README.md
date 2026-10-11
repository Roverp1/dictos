# @dictos/wasm-turso-sync

This package contains a browser `SyncPort` adapter using the `@tursodatabase/sync-wasm` client. Its code remains in the repo with the broken, unmaintained Web client. Browser/WASM behavior is unsupported and unverified.

## Testing Strategy

This package does not bind the shared contracts from `@dictos/core/testing` or `@dictos/db-core/testing` and has no package-local integration runner.

`@tursodatabase/sync-wasm` depends on browser APIs such as OPFS. A package-local Vitest/Playwright setup would add heavy dependencies and provide a weaker environment than a real cross-platform application flow.

`@dictos/bun-turso-sync` runs the shared domain-port and SQLite schema contracts against a real local Turso database. This package has only a `typecheck` script, and root test/typecheck scripts exclude browser workspaces. There are no active Web/browser E2E tests, so those commands do not verify this adapter.

When Web support resumes, cross-platform browser E2E tests should cover WASM migration, OPFS persistence, and Bun/WASM replication compatibility.

Do not add Vitest, Playwright, browser binaries, or a local `test` script to this package without first changing this documented strategy.
