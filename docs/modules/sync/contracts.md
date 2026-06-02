# Interfaces & Contracts: Sync

**Parent**: [Sync Domain](./domain.md)

## Outbound Ports

### `SyncPort`
Implemented by the database adapter (e.g., `BunTursoClient`) to manage the underlying replication engine.
- `connectRemote(url, token)`: Connects the local replica to the Turso Cloud URL.
- `sync()`: Executes a `push()`, then a `pull()`, and a background `checkpoint()`. Returns `SyncResult`.
- `disconnectRemote()`: Severs the cloud connection.

### `ConnectivityPort`
Implemented by the HTTP adapter to provide fast-fail offline detection.
- `isOnline()`: Resolves boolean. Usually implemented as a 1500ms timeout `HEAD` request to a known reliable endpoint (e.g., the Central Server health check).

### `AuthPort`
Implemented by the HTTP adapter to communicate with the Central API.
- `login() / register()`: Returns an `AuthResult` which separates the fat server JSON into a `User` domain object (for the synced DB) and an `AuthSession` object (for the local file system).

### `SessionRepository` & `LocalStateRepository`
Implemented by file-system adapters (e.g., `packages/adapters/fs`) to persist device state.
- `LocalStateRepository`: Guarantees a persistent `deviceId` via `getLocalState()` and `resetLocalState()`.
- `SessionRepository`: Stores the transient `AuthSession` (JWT and Turso credentials).
