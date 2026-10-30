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

- `LocalStateRepository`: `getLocalState(): Promise<LocalState | StorageError>` returns `{ deviceId: string }`, initializing an identity only when the file is absent. `resetLocalState(): Promise<LocalState | StorageError>` explicitly replaces identity. Existing valid identity reads do not rewrite the file; invalid JSON or identity returns `StorageError` without replacement. There is no Model setter. The filesystem adapter uses `<dataDir>/local-state.json`; the retained browser adapter uses local storage.
- `SessionRepository`: Stores the transient `AuthSession` (JWT and Turso credentials) separately at native `<dataDir>/session.json`. Session persistence does not write TOML configuration or move the synced `User` profile out of the database.

### `ProviderConnectionRepository`, `ModelCatalogStore` & `ModelCatalogPort`

- `ProviderConnectionRepository` is a device-local credential boundary, not a Sync port. Its filesystem adapter stores Provider ID-keyed API keys in `<dataDir>/providers.json`. `create`, `replaceKey`, and `delete` manage one credential per Provider ID; `findAll()` exposes only safe Provider IDs, while `findByProviderId()` returns the credential only for targeted use.
- `ModelCatalogStore` is a device-local cache boundary: `read()` returns a cached catalog, `null`, or a storage error; `replace(catalog)` persists a validated version 2 cache in `<dataDir>/model-catalog.json`. Version 1 lacks the derived `textGeneration` marker and falls back to the bundled snapshot without deleting the file. `ModelCatalogPort.get()` uses the cache when valid or the bundled snapshot; `refresh()` fetches catalog metadata and replaces the cache on success. Neither port writes to the Dictionary database.
- `ProviderConnectionService.disconnect()` removes only the requested Provider credential. It has no local-state dependency and does not change configuration or a workflow's Selected Model. Generation services still validate the explicit Selected Model against the catalog and configured connection when used, with no automatic fallback. No `ModelSelectionService` or persisted selection operation remains.

### Application Configuration Boundary

`@dictos/config` owns portable leaf schemas, inferred types, defaults, scope validation, resolution, provenance, and immutable snapshots. `@dictos/fs-storage/configuration` handles native paths, TOML decoding, and missing starter-file initialization. Core has no configuration dependency; generation receives explicit Model inputs, and Sync receives its existing session and replication inputs. See the [configuration reference](../../configuration.md) for shared file and resolution rules.

Direct CLI invocations load shared → CLI configuration. `dictos overlay bootstrap --json` always resolves a fresh native shared → CLI → Overlay chain, ignoring inherited snapshots. It returns the opening's snapshot without opening the Dictionary, initializing device identity, reading credentials, or making network requests. The launcher passes that snapshot through internal `DICTOS_OVERLAY_CONFIG_SNAPSHOT` transport to its CLI children, including direct state helpers. Children validate and retain it, including the inherited CLI logging level, without loading replacement files or reapplying environment overrides. Invalid inherited snapshots fail without disk fallback.

A configured Default Model initializes new work. CLI `--model` and Overlay picker choices change only the current Selected Model; they never write configuration or local identity. Suggestion/generation requests must carry an explicit qualified Model ID; missing or malformed IDs use `INVALID_REQUEST`, exit `2`, without substituting a default. Save and state payloads have no Model field. Full generation and transport contracts are in [Description Generation](../description-generation/contracts.md).

Configuration failures return Error values and use exit `5` and `CONFIGURATION_ERROR` across bootstrap, operations, Model/Instruction JSON listing, and direct state helpers. JSON failures contain a safe, actionable `error.message` and nonempty `error.issues` identifying source, key path, available location, and reason. They do not expose raw values, TOML, snapshot payloads, or parser causes. Clients can display the message directly; the launcher reports startup failures and an open Overlay shows Notifications while retaining drafts.

## Synced and Device-Local Boundaries

- The shared database schema includes Entries, Descriptions (including generated content and Type/Sense assignments), Senses, Instructions, and their lifecycle fields. Schema changes must be applied from the same baseline on every replica before Sync reconnects.
- Local device identity, authentication session files, Provider Connection credentials, the Model Catalog cache, configuration files, Overlay-local Instruction/Type state, and process configuration snapshots stay outside Sync and Mirroring. Runtime Selected Models are never persisted. These values are not added to the shared SQLite schema or replicated as Dictionary data; existing authentication API exchanges remain unchanged.
- Configuration and runtime selection introduce no Dictionary schema, transaction, Sync record, or migration changes. Accepted generation proposals and reviewed saves retain their existing atomic persistence contracts, and saved generated content Syncs like other Descriptions.
