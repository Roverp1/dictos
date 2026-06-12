# Domain: Sync

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Jun 2, 2026

## Module Responsibility

Responsible for the bidirectional replication of private local data across a single user's devices using Turso Sync. It handles offline-first conflict resolution, orchestrates database connections, and strictly segregates device-specific credentials from synced user profile data.

## Core Workflows

### Authentication & Initialization (Thin Session)

1. The user logs in via the Central Server API.
2. The server provisions or fetches a dedicated Turso database and returns an `AuthResult` containing both the `User` profile and `AuthSession` secrets.
3. The `AuthService` saves the `User` profile into the local, synced Turso SQLite database (via `UserRepository`) using `INSERT ... ON CONFLICT DO UPDATE`.
4. The `AuthService` saves the device-specific `AuthSession` (JWT and Turso URL/Token) to a local, un-synced configuration file (via `SessionRepository`).
5. On app startup, the TUI hydrates by reading the `userId` from the local config file, and then querying the absolute latest synced profile from the local Turso database.

### Synchronization (Push & Pull)

1. The user (or an automated timer) triggers `SyncService.sync()`.
2. The `SyncService` performs a fast-fail network check via `ConnectivityPort`. If offline, it returns an `OfflineError` instantly without blocking the UI.
3. If online, the `BunTursoClient` pushes local Write-Ahead Log (WAL) changes to the remote Turso Cloud.
4. The client then pulls any remote changes down to the local replica.
5. The client performs a background `checkpoint()` to compact the local WAL.
6. The service returns a `SyncResult` detailing whether local changes were pushed or remote changes were pulled, enabling the UI to refresh reactively.

## Key Decisions & Trade-offs

- **Offline Local Sync Development**: Local development (`devenv up`) runs a fully offline `tursodb --sync-server` process. The Central Server mocks the Turso Platform API when `NODE_ENV === "development"`, and the web client uses a Vite proxy interceptor to bypass browser CORS checks, allowing full push/pull testing without cloud credentials or costs.
- **Vite-Native WASM Migrator**: Web clients apply database schema changes locally via a custom engine that leverages Vite's `import.meta.glob` to bundle Drizzle SQL migrations into the build, circumventing the browser's lack of a filesystem.
- **Deterministic UUIDv5 for Entities**: To prevent split-brain conflicts during offline sync, `folders` and `entries` use deterministic UUIDv5s based on their parent and text. Identical entities created offline on multiple devices merge flawlessly without SQLite constraint violations.
- **Device-Isolated Activity Counters**: To track activity without unique constraint crashes during sync, the `activities` table drops the `UNIQUE(date)` constraint. It uses a UUIDv5 based on `date:deviceId`, allowing multiple isolated rows per date that the UI simply sums together (a basic CRDT pattern).
- **Thin Session Pattern**: Because Turso syncs the entire SQLite file, storing JWTs inside the database would cause devices to log each other out upon sync. Device state is strictly segregated to the local file system.
- **Non-Blocking Background Sync**: Sync operations and connection initializations are wrapped in IIFEs (Immediately Invoked Function Expressions) during app bootstrap so the TUI renders the local database instantly in milliseconds.

## Known Edge Cases & Constraints

- **TursoDB Self-Referencing Cascade Crash**: Native `ON DELETE CASCADE` causes fatal stack overflows in the TursoDB engine for self-referential keys (e.g., `folders.parentId`). We handle recursive folder deletion manually via an application-level Breadth-First Search (BFS) in the `SqliteFolderRepository`.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
