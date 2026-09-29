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

- `login() / register()`: Returns an `AuthResult` that separates the server JSON into a `User` domain object (for the synced DB) and an `AuthSession` object (for the local file system).

### `SessionRepository` & `LocalStateRepository`

Implemented by adapters in `packages/fs-storage` to persist device state.

- `LocalStateRepository`: `getLocalState()` returns the persistent `deviceId` and `selectedModel: SelectedModel | null`; `setSelectedModel(value)` changes the device-local choice without changing `deviceId`. `resetLocalState()` explicitly resets the device identity and clears the choice. The filesystem adapter stores this in `<dataDir>/local-state.json`; the browser adapter uses local storage.
- `SessionRepository`: Stores the transient `AuthSession` (JWT and Turso credentials).

### `ProviderConnectionRepository`, `ModelCatalogStore` & `ModelCatalogPort`

- `ProviderConnectionRepository` is a device-local credential boundary, not a Sync port. Its filesystem adapter stores Provider ID-keyed API keys in `<dataDir>/providers.json`. `create`, `replaceKey`, and `delete` manage one credential per Provider ID; `findAll()` exposes only safe Provider IDs, while `findByProviderId()` returns the credential only for targeted use.
- `ModelCatalogStore` is a device-local cache boundary: `read()` returns a cached catalog, `null`, or a storage error; `replace(catalog)` persists a validated version 2 cache in `<dataDir>/model-catalog.json`. Version 1 lacks the derived `textGeneration` marker and falls back to the bundled snapshot without deleting the file. `ModelCatalogPort.get()` uses the cache when valid or the bundled snapshot; `refresh()` fetches catalog metadata and replaces the cache on success. Neither port writes to the Dictionary database.
- `ModelSelectionService` uses the catalog and configured Provider Connection to validate a qualified `provider/model` ID before `LocalStateRepository.setSelectedModel()` persists it. A one-command override does not alter the saved choice; disconnecting its Provider clears a matching choice before deleting the credential. No automatic Model fallback crosses this boundary.

## Synced and Device-Local Boundaries

- The shared database schema includes Entries, Descriptions (including generated content and Type/Sense assignments), Senses, Instructions, and their lifecycle fields. Schema changes must be applied from the same baseline on every replica before Sync reconnects.
- Provider Connection credentials, the Model Catalog cache, and `LocalState.selectedModel` stay outside Sync and Mirroring. They are not stored in the shared SQLite schema or sent to the central server; these device-local contracts require no synced schema change or migration.
