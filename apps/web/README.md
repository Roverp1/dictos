# Web client

This Vite + React Router SPA was generated from the TUI as an exploration. Its code is retained, but the app is broken, unmaintained, and unsupported.

The code composes `@dictos/react` with browser adapters, including `@dictos/wasm-turso-sync` for local Turso data in OPFS. These browser flows are not currently verified.

The manual Vite command is `bun run dev:web`, but the app remains broken. `devenv up` starts the central server and local sync server, not the Web client. Root test/typecheck scripts exclude browser workspaces, and there are no active Web/browser E2E tests. WASM migration, OPFS persistence, and replication remain unverified. See [`docs/testing.md`](../../docs/testing.md) and [`packages/wasm-turso-sync/README.md`](../../packages/wasm-turso-sync/README.md) for the testing boundary.
