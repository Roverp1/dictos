# Tasks: Improve Adapters and Reliability

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Migrator Logic

- [x] T001: Implement the custom `migrateWasm` utility in `packages/wasm-turso-sync/src/migrator.ts`.
- [x] T002: [P] Update `@dictos/logger` interface if necessary (ensure it supports the required context shapes).
- [x] T003: [P] Verify Vite `import.meta.glob` setup in a sample environment to confirm SQL string loading.

## Phase 2: Adapter Refactoring (Bun)

- [x] T004: Replace all `console.log` and `console.error` calls in `BunTursoClient` with `this.logger`.
- [x] T005: Add structured logging to `BunTursoClient.create` (connection, migrations).
- [x] T006: Add structured logging to `BunTursoClient.sync` (push/pull stats, errors).

## Phase 3: Adapter Refactoring (WASM)

- [x] T007: Integrate `migrateWasm` into `WasmTursoClient.create`.
- [x] T008: Remove the legacy `migrationString` hack from `WasmTursoClient`.
- [x] T009: Replace all `console` calls in `WasmTursoClient` with `this.logger`.
- [x] T010: Add structured logging to `WasmTursoClient.sync` (using Turso stats).

## Phase 4: Integration Testing

- [ ] T011: Setup `packages/bun-turso-sync/tests/` with `bun test` configuration.
- [ ] T012: Implement `sync.test.ts` verifying bidirectional sync between two local instances.
- [ ] T013: Implement a test case for concurrent migration application to verify `__drizzle_migrations` stability.

## Phase 5: Developer Environment Infrastructure (Devenv)

- [x] T014: Remove the existing `flake.nix` and `flake.lock`.
- [x] T015: Run `devenv init` to generate baseline `devenv.nix` and `devenv.yaml`.
- [x] T016: Configure `devenv.nix` to provide `bun` and `turso-cli` packages.
- [x] T017: Configure `devenv.nix` process manager (`devenv up`) to orchestrate `dev:server` and `dev:web`.
- [x] T018: Create `secretspec.toml` to declaratively require `TURSO_AUTH_TOKEN`.
- [x] T019: Validate the environment (verify tool versions and test `devenv up`).
- [x] T020: Implement the "Lazy Init" pattern in `devenv.nix` `enterShell` hook to guide new users through `secretspec config init` non-blockingly.
- [x] T021: Add the `tursodb --sync-server 0.0.0.0:8080` process to `devenv.nix` to enable offline local development without Turso Cloud.
- [x] T022: Configure Vite proxy in `apps/web/vite.config.ts` to intercept `/v1`, `/v2`, `/pull-updates`, and `/push-updates` to resolve browser CORS errors against the local sync server.
- [x] T023: Mock the Turso Platform API in `apps/server/src/modules/auth/turso-platform.service.ts` to return `TURSO_SYNC_URL` when `NODE_ENV === "development"`.
- [x] T024: Add an interceptor in `packages/wasm-turso-sync/src/wasm-turso-client.ts` to cleanly rewrite the port `8080` URL to the Vite proxy `5173` only when `import.meta.env.DEV` is true.

## Phase 6: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (System Overview and Modules) and archive this specification.
- [ ] **Manual Verification:** Ensure any new domain vocabulary used during this feature was grilled and added to `CONTEXT.md`.

## Additional Work (Completed)

- [x] Documented structured logging best practices in a new `logger` skill.
- [x] Added `trace` and `child` methods to the `@dictos/logger` interface.
- [x] Created `pino-prettify-browser` to format logs beautifully in the web client console.
- [x] Installed `vite` in `wasm-turso-sync` to fix `import.meta.glob` typechecking errors.
