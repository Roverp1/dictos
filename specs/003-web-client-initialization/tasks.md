# Tasks: Web Client Initialization

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and package boundaries first so devs can parallelize later)._

- [ ] T001: [US1] Create structural package boundaries (folders, `package.json`, `tsconfig.json`) for: `db-core`, `bun-turso-sync`, `wasm-turso-sync`, `eden-http`, `fs-storage`, `local-storage`, and `pino-logger`.
- [ ] T002: [US1] Move all Drizzle schema definitions, relationships, and `drizzle.config.ts` from `adapters` to the new `@dictos/db-core` package.
- [ ] T003: [US1] Update workspace configuration and resolve root `tsconfig.json` path mappings for the new package names.

## Phase 2: Core Logic & Interfaces

_(Implement the newly isolated packages in parallel based on Phase 1 contracts)_

- [ ] T004: [P] [US1] Refactor `@dictos/pino-logger` to remove the hardcoded file path and accept an injected `pino.Logger` instance.
- [ ] T005: [P] [US1] Migrate `FsSessionRepository` and `FsLocalStateRepository` into `@dictos/fs-storage`.
- [ ] T006: [P] [US1] Implement `LocalStorageSessionRepository` and `LocalStorageStateRepository` in `@dictos/local-storage` using the browser's `window.localStorage` API.
- [ ] T007: [P] [US1] Migrate the existing Eden Treaty logic from the old `http` adapter to the newly named `@dictos/eden-http` package.
- [ ] T008: [P] [US1] Implement `@dictos/bun-turso-sync` to initialize the connection using `@tursodatabase/sync` (Node) and inject it into the `db-core` repositories.
- [ ] T009: [P] [US1] Implement `@dictos/wasm-turso-sync` to initialize the connection using `@tursodatabase/sync-wasm` and inject it into the `db-core` repositories.

## Phase 3: UI & Integration

- [ ] T010: [US1] Update the TUI Application (`apps/tui`) composition root to inject the new granular packages (`bun-turso-sync`, `fs-storage`, `pino-logger`, `eden-http`).
- [ ] T011: [US1] Run TUI tests and manual verification to ensure the adapter refactor caused no regressions.
- [ ] T012: [US2] Initialize `apps/web` using Vite (React, TS) and set up React Router as a standard library (no SSR framework configuration).
- [ ] T013: [US2] Wire up the Web App composition root to inject `@dictos/wasm-turso-sync`, `@dictos/local-storage`, `@dictos/eden-http`, and the console-configured `@dictos/pino-logger` into the `DictosProvider`.
- [ ] T014: [US2] Render a basic Dictionary view in the web client to verify the headless React logic and Turso WASM database data flow are functioning end-to-end.

---

## Phase N: Absorb into Documentation

- [ ] T015: Update `docs/system-overview.md` to reflect the newly split adapter architecture and the existence of the `apps/web` client.
- [ ] T016: Review and update any relevant `docs/modules/[domain]/` files if the adapter layer restructuring affects documented domain implementations (e.g., storage mapping).
- [ ] T017: Run `/docify.absorb` to automatically update the living Documentation and archive this specification.
- [ ] T018: **Manual Verification:** Ensure any new domain vocabulary used during this feature was grilled and added to `CONTEXT.md` (Note: "OPFS", "LocalStorage", etc., are technical, not domain, so this is likely a no-op for this feature).
