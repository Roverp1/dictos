# Domain: Sync

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Oct 26, 2026

## Module Responsibility

Sync replicates private local data in both directions across a single user's devices using Turso Sync. It handles offline-first conflict resolution and orchestrates database connections while keeping device-specific credentials separate from synced user profile data.

## Core Workflows

### Authentication & Initialization (Thin Session)

1. The user logs in via the Central Server API.
2. The server provisions or fetches a dedicated Turso database and returns an `AuthResult` containing both the `User` profile and `AuthSession` secrets.
3. The `AuthService` saves the `User` profile into the local, synced Turso SQLite database (via `UserRepository`) using `INSERT ... ON CONFLICT DO UPDATE`.
4. The `AuthService` saves the device-specific `AuthSession` (JWT and Turso URL/Token) to the local, unsynced `<dataDir>/session.json` file (via `SessionRepository`). This session file is separate from application configuration.
5. On app startup, the TUI reads the `userId` from the local session, then queries the latest synced profile from the local Turso database to hydrate.

### Synchronization (Push & Pull)

1. The user (or an automated timer) triggers `SyncService.sync()`.
2. The `SyncService` performs a fast-fail network check via `ConnectivityPort`. If offline, it returns an `OfflineError` promptly without blocking the UI.
3. If online, the `BunTursoClient` pushes local Write-Ahead Log (WAL) changes to the remote Turso Cloud.
4. The client then pulls any remote changes down to the local replica.
5. The client performs a background `checkpoint()` to compact the local WAL.
6. The service returns a `SyncResult` detailing whether local changes were pushed or remote changes were pulled, enabling the UI to refresh reactively.

## Key Decisions & Trade-offs

- **Offline Local Sync Development**: `devenv up` runs a local `tursodb --sync-server` process alongside the Central Server. The Central Server mocks the Turso Platform API when `NODE_ENV === "development"`. The retained Web client has a Vite proxy interceptor for browser CORS. `devenv up` does not start Web, and browser push/pull is unverified.
- **Vite-Native WASM Migrator**: The retained Web app uses Vite's `import.meta.glob` to bundle Drizzle SQL migrations without relying on Node's filesystem. The Web app is broken and unsupported, so this migration path is unverified.
- **Deterministic UUIDv5 for Entities**: To prevent split-brain conflicts during offline sync, `folders` and `entries` use deterministic UUIDv5s based on their parent and text. Identical entities created offline on multiple devices merge without SQLite constraint violations.
- **Device-Isolated Activity Counters**: To track activity without unique constraint crashes during sync, the `activities` table drops the `UNIQUE(date)` constraint. It uses a UUIDv5 based on `date:deviceId`, allowing multiple isolated rows per date that the UI simply sums together (a basic CRDT pattern).
- **Thin Session Pattern**: Because Turso syncs the entire SQLite file, storing JWTs inside the database would cause devices to log each other out upon sync. Device state stays in the local file system.
- **Synced Dictionary Content**: Entries, Folders, Descriptions (including generated Descriptions and their Type/Sense assignments), Senses, and reusable Instructions live in the shared Dictionary database and participate in Sync. Senses remain distinct even when created offline with the same interpretation.
- **Device-Local Description Generation Setup**: Provider Connections and API keys, the Model Catalog cache, and configuration files remain outside the Dictionary database, Sync, and Mirroring. Each device configures its own credentials and Default Model. The Selected Model belongs only to one command or client workflow and is never persisted. A bundled catalog or device-local cache supports offline Model browsing without becoming synced user data. Syncing generated Descriptions does not sync the Provider Connection or Model used to produce them. Disconnecting a Provider removes only its credential and leaves configuration unchanged.
- **Identity and Configuration Separation**: `LocalState` contains only `deviceId`, which activity counters use to distinguish devices. Its operations get or explicitly reset that identity. Application settings live separately in native TOML files. `@dictos/config` owns portable validation, defaults, resolution, provenance, and snapshots; `@dictos/fs-storage/configuration` handles native discovery, TOML, and starter-file creation when files are missing. Core remains configuration-free. An Overlay holds its opening's immutable configuration while its Selected Model can change in memory. None of these settings or snapshots participates in Sync or Mirroring. See the [configuration reference](../../configuration.md).
- **Destructive Baseline Reset**: The Description Generation schema was introduced through a fresh pre-release baseline rather than an incremental data migration. Any replica still using the earlier migration journal must be recreated from the current baseline before reconnecting to Sync.
- **Non-Blocking Background Sync**: Sync operations and connection initializations are wrapped in IIFEs (Immediately Invoked Function Expressions) during app bootstrap so the TUI can render the local database in milliseconds.

## Known Edge Cases & Constraints

- **TursoDB Self-Referencing Cascade Crash**: Native `ON DELETE CASCADE` causes fatal stack overflows in the TursoDB engine for self-referential keys (e.g., `folders.parentId`). We handle recursive folder deletion manually via an application-level Breadth-First Search (BFS) in the `SqliteFolderRepository`.
- Offline devices can create distinct Senses that describe the same interpretation. Sync preserves both because semantic duplicate detection is not a synchronization rule.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
- [Configuration reference](../../configuration.md)
