# Tasks: Improve Adapters and Reliability

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Migrator Logic

- [ ] T001: Implement the custom `migrateWasm` utility in `packages/wasm-turso-sync/src/migrator.ts`.
- [ ] T002: [P] Update `@dictos/logger` interface if necessary (ensure it supports the required context shapes).
- [ ] T003: [P] Verify Vite `import.meta.glob` setup in a sample environment to confirm SQL string loading.

## Phase 2: Adapter Refactoring (Bun)

- [ ] T004: Replace all `console.log` and `console.error` calls in `BunTursoClient` with `this.logger`.
- [ ] T005: Add structured logging to `BunTursoClient.create` (connection, migrations).
- [ ] T006: Add structured logging to `BunTursoClient.sync` (push/pull stats, errors).

## Phase 3: Adapter Refactoring (WASM)

- [ ] T007: Integrate `migrateWasm` into `WasmTursoClient.create`.
- [ ] T008: Remove the legacy `migrationString` hack from `WasmTursoClient`.
- [ ] T009: Replace all `console` calls in `WasmTursoClient` with `this.logger`.
- [ ] T010: Add structured logging to `WasmTursoClient.sync` (using Turso stats).

## Phase 4: Integration Testing

- [ ] T011: Setup `packages/bun-turso-sync/tests/` with `bun test` configuration.
- [ ] T012: Implement `sync.test.ts` verifying bidirectional sync between two local instances.
- [ ] T013: Implement a test case for concurrent migration application to verify `__drizzle_migrations` stability.

## Phase 5: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (System Overview and Modules) and archive this specification.
- [ ] **Manual Verification:** Ensure any new domain vocabulary used during this feature was grilled and added to `CONTEXT.md`.
