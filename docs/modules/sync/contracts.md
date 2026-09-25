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

Implemented by adapters in `packages/fs-storage` to persist device state.

- `LocalStateRepository`: Guarantees a persistent `deviceId` via `getLocalState()` and `resetLocalState()`.
- `SessionRepository`: Stores the transient `AuthSession` (JWT and Turso credentials).

## Synced and Device-Local Boundaries

- The shared database schema includes Entries, Descriptions, Senses, Instructions, and their lifecycle fields. Schema changes must be applied from the same baseline on every replica before Sync reconnects.
- `ProviderConnectionRepository` is deliberately not a Sync port. Its filesystem adapter stores API keys in device-local `providers.json`; no Provider Connection credential is written to the synced database or sent to the central server.
