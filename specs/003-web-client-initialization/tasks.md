# Tasks: Web Client Initialization

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Infrastructure (COMPLETED)

- [x] T001: [US1] Create structural package boundaries (folders, `package.json`, `tsconfig.json`) for: `db-core`, `bun-turso-sync`, `eden-http`, `fs-storage`, and `pino-logger`.
- [x] T002: [US1] Move all Drizzle schema definitions, relationships, and `drizzle.config.ts` from `adapters` to the new `@dictos/db-core` package.
- [x] T003: [US1] Modernize TS configuration (base config, removal of composite references) and set up Turborepo.
- [x] T004: [US1] Implement `bun-security-scanner` and global project configuration.

## Phase 2: Core Logic & Adapters (IN PROGRESS)

- [x] T005: [US1] Refactor `@dictos/pino-logger` to accept an injected `pino.Logger` instance.
- [x] T006: [US1] Migrate `FsSessionRepository` and `FsLocalStateRepository` into `@dictos/fs-storage`.
- [x] T007: [US1] Migrate Eden Treaty logic to `@dictos/eden-http`.
- [x] T008: [US1] Implement `@dictos/bun-turso-sync` to initialize connection and inject it into repositories.
- [x] T009: [US1] Update TUI Application (`apps/tui`) composition root to use new granular packages.
- [ ] T010: [P] [US1] Implement `LocalStorageSessionRepository` and `LocalStorageStateRepository` in `@dictos/local-storage` (Needs initialization).
- [ ] T011: [P] [US1] Implement `@dictos/wasm-turso-sync` package boundaries and initialization logic.
- [ ] T012: [P] [US1] Implement `@dictos/wasm-turso-sync` connection logic using `@tursodatabase/sync-wasm`.

## Phase 3: Web UI & Integration

- [ ] T013: [US2] Initialize `apps/web` using Vite (React, TS) and set up React Router as a library.
- [ ] T014: [US2] Wire up Web App composition root with WASM Sync, LocalStorage, and Browser Logger.
- [ ] T015: [US2] Implement a basic Dictionary view and verify data flow from Turso WASM.

---

## Phase N: Absorb into Documentation

- [ ] T016: Update `docs/system-overview.md` to reflect the new architecture.
- [ ] T017: Run `/docify.absorb` to update documentation and archive this specification.
