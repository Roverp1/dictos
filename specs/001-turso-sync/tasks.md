# Tasks: Turso Cross-Device Synchronization

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and database schemas first so devs can parallelize later)._

- [x] T001: Delete the existing local `.db` files and `/drizzle/migrations/` to start fresh and avoid complex data migration.
- [x] T002: Update Drizzle schemas (`foldersTable`, `entriesTable`, `descriptionsTable`) to replace integer `id` primary keys and foreign keys with `text` (UUIDs). Use `$defaultFn(() => crypto.randomUUID())` for local generation.
- [ ] T003: [P] Update Core domain interfaces/types in `packages/core` to expect `string` IDs instead of `number` IDs.
- [ ] T004: [P] Define TypeScript interfaces for the updated Auth payloads in the shared types module, including the new `turso: { url, token }` response object.

## Phase 2: Core Logic & Interfaces

_(Backend and Frontend can often work in parallel here based on Phase 1 contracts)_

- [ ] T005: [@Backend] Refactor Elysia server `/auth/register` to use the Turso Platform API to provision a dedicated per-user database and issue a scoped database token.
- [ ] T006: [@Backend] Refactor Elysia server `/auth/login` to issue a fresh scoped database token for the existing user database.
- [ ] T007: [@Frontend] Swap `@libsql/client` and `drizzle-orm/libsql` for `@tursodatabase/sync` and `drizzle-orm/sqlite-proxy` in `packages/adapters/package.json`.
- [ ] T008: [@Frontend] Implement the `IBunTursoClient` class (e.g., `BunTursoClient`) in `packages/adapters/db/clients/bun-turso-client.ts` to expose the proxy `db` instance and manage the Turso client container.
- [ ] T009: [@Frontend] Implement the `SyncPort` interface on `BunTursoClient` (`connectRemote`, `sync`, `disconnectRemote`).
- [ ] T009b: [@Frontend] Create `ISyncService` and its implementation `SyncService` in `packages/core` to proxy calls to the `SyncPort`.
- [ ] T009c: [@Frontend] Rename the legacy `LibSql*Repository` classes to `Sqlite*Repository` and move them into `packages/adapters/db/repositories/`.

## Phase 3: UI & Integration

- [ ] T010: Update the TUI Auth Service to handle the new Auth payload and securely store the `turso.url` and `turso.token` alongside the session JWT.
- [ ] T011: Modify TUI `bootstrap()` in `main.tsx` to automatically invoke `connectRemote()` with stored credentials if they exist on app startup, otherwise defaulting to local-only initialization.
- [ ] T012: Implement the "Sync Now" UI trigger (e.g., a keyboard shortcut or menu item in the dictionary view) that invokes the adapter's `sync()` method.
- [ ] T013: Implement UI feedback (e.g., loading spinner, success message, error toast) for the sync action.

---

## Phase N: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (`docs/system-overview.md` and module docs) with the newly defined sync architectural approach and proxy patterns.
- [ ] **Manual Verification:** Ensure any new domain vocabulary used during this feature (like "Sync", "Bootstrap") was grilled and added to `CONTEXT.md` if applicable.
