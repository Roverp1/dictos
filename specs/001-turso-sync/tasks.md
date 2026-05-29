# Tasks: Turso Cross-Device Synchronization

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and database schemas first so devs can parallelize later)._

- [x] T001: Deleted the existing local `.db` files and `/drizzle/migrations/` to start fresh and avoid complex data migration.
- [x] T002: Updated Drizzle schemas (`foldersTable`, `entriesTable`, `descriptionsTable`) to replace integer `id` primary keys and foreign keys with `text` (UUIDs). Use `$defaultFn(() => crypto.randomUUID())` for local generation.
- [x] T003: [P] Updated Core domain interfaces/types in `packages/core` to expect `string` IDs instead of `number` IDs.
- [x] T004: [P] Defined TypeScript interfaces for the updated Auth payloads in the shared types module, including the new `turso: { url, token }` response object.
- [x] T004b: Updated central server database schemas (`usersTable`, `centralActivityTable`) to use UUID text primary keys, matching the local client schemas.
- [x] T004c: Standardized central server API responses (wrap success in `data` object, format all errors to RFC 9457 specifications via global error plugin).
- [x] T004d: Refactored `CentralApiAdapter` to safely parse Eden Treaty discriminated unions, mapping RFC 9457 HTTP errors into pure Core domain errors.

## Phase 2: Core Logic & Interfaces

_(Backend and Frontend can often work in parallel here based on Phase 1 contracts)_

- [x] T005: [@Backend] Refactored Elysia server `/auth/register` to use the Turso Platform API to provision a dedicated per-user database and issue a scoped database token.
- [x] T006: [@Backend] Refactored Elysia server `/auth/login` to issue a fresh scoped database token for the existing user database.
- [x] T007: [@Frontend] Swapped `@libsql/client` and `drizzle-orm/libsql` for `@tursodatabase/sync` and `drizzle-orm/sqlite-proxy` in `packages/adapters/package.json`.
- [x] T008: [@Frontend] Implemented the `BunTursoClient` class in `packages/adapters/db/clients/bun-turso-client.ts` to expose the proxy `db` instance and manage the Turso client container using deferred sync state.
- [x] T009: [@Frontend] Implemented the `SyncPort` interface on `BunTursoClient` (`connectRemote`, `sync`, `disconnectRemote`).
- [x] T009b: [@Frontend] Created `SyncService` in `packages/core` to proxy calls to the `SyncPort`.
- [x] T009c: [@Frontend] Renamed the legacy `LibSql*Repository` classes to `Sqlite*Repository` and moved them into `packages/adapters/db/repositories/`.

## Phase 3: UI & Integration

- [x] T010: Updated the `SqliteSessionRepository` to persist the `turso.url` and `turso.token` alongside the session JWT, handling the optional nature of the sync feature.
- [x] T011: Modified TUI `bootstrap()` in `main.tsx` to automatically invoke `connectRemote()` with stored credentials if they exist on app startup.
- [x] T012: Integrated `SyncService` into `AuthService` so that registering or logging in dynamically upgrades the live database connection to cloud-sync mode.
- [x] T013: Implemented the "Sync Now" UI trigger that invokes the adapter's `sync()` method.
- [ ] T014: Implement UI feedback (e.g., loading spinner, success message, error toast) for the sync action.
- [ ] T015: [@Frontend] Implement deterministic UUIDv5 generation for `foldersTable` and remove the `unique().on(name, parentId)` constraint to allow conflict-free cross-device folder merging.
- [ ] T016: [@Frontend] Remove `unique()` constraint on `activityTable.date` to support append-only sync and update frontend logic to `SUM(count)` activities per date.

### Discovered & Resolved Edge Cases

- [x] E001: Fixed missing SQLite `folder_id` column error caused by `drizzle-orm/sqlite-proxy` ignoring `casing` configuration by explicitly mapping column names in `schema.ts`.
- [x] E002: Fixed `NOT NULL constraint failed: activity.id` caused by native SQLite triggers by updating migrations to use `lower(hex(randomblob(16)))`.
- [x] E003: Re-enabled foreign key constraints dynamically on every connection within `BunTursoClient`.
- [x] E004: Fixed `Host not found` TUI crash on startup by implementing late-binding lambdas for `url` and `authToken`.
- [x] E005: Fixed silent `Sync push/pull failed` error by passing the mutable `SyncCredentials` state properly to the client constructor.
- [ ] E006: Fix `UNIQUE constraint failed: activity.date` conflict during offline merge by adopting an append-only CRDT approach.
- [ ] E007: Reverse registration logic order to provision Turso database _before_ persisting user to central server to prevent orphaned central accounts.
- [ ] E008: Fix manual URL generation missing critical regional suffixes (e.g., `.aws-eu-west-1`).

---

## Phase N: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (`docs/system-overview.md` and module docs) with the newly defined sync architectural approach and proxy patterns.
- [ ] **Manual Verification:** Ensure any new domain vocabulary used during this feature (like "Sync", "Bootstrap") was grilled and added to `CONTEXT.md` if applicable.