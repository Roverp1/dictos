# Data Model: Sync

**Parent**: [Sync Domain](./domain.md)

## Core Entities

### LocalState (Device Identity)

`LocalState` holds persistent device identity outside the synced database. Its complete core shape is `{ deviceId: string }`.

- `deviceId`: Persistent UUIDv4 identifying the physical installation. Used to namespace activity CRDTs.

The filesystem adapter uses `<dataDir>/local-state.json`. A missing file initializes an identity; reading an existing valid identity preserves it without rewriting the file. Invalid JSON or an invalid device identity returns `StorageError` rather than generating a replacement. Only explicit reset replaces identity. There is no Model field or selection setter. The retained browser adapter uses `dictos_local_state` in local storage; this port adjustment adds no browser configuration support.

### AuthSession (Thin Session)

Represents the temporary authentication secrets.

- `userId`: Link to the synced `User` profile.
- `token`: Central API JWT.
- `turso`: Cloud database credentials (`url`, `token`).

The native session store is `<dataDir>/session.json`, separate from identity, Provider credentials, and TOML settings. The `User` profile remains a synced database record; session secrets do not Sync or enter Mirroring.

### Application Configuration and Runtime Model Choice

Native application settings live in the configuration directory, independently of `<dataDir>`. The global, CLI, and Overlay files and their rules are defined in the [configuration reference](../../configuration.md). They contain no device identity, authentication session, Provider credential, Model Catalog cache, or remembered Overlay input.

The optional Default Model initializes a command or workflow's Selected Model. Explicit CLI `--model` and the Overlay picker affect only the current command or workflow, without persisting selection or editing configuration. An Overlay keeps one immutable version-1 configuration snapshot with effective settings and provenance for its children. The runtime Selected Model is not a snapshot field. Configuration files, process snapshots, runtime Model choices, and remembered Overlay Instruction/Type state are all outside Sync and Mirroring.

### SyncResult

Reports sync operation metrics to the UI.

- `pushedLocalChanges`: `boolean`
- `pulledRemoteChanges`: `boolean`
- `stats.bytesSent`: `number`
- `stats.bytesReceived`: `number`
- `stats.operationsSynced`: `number`

## Database Schemas (SQLite / Drizzle)

### `foldersTable` & `entriesTable`

- Primary Keys (`id`) are generated locally via deterministic UUIDv5 (e.g., `parentId:name` for folders) to allow identical offline creations on separate devices to merge natively on Turso without conflict.

### `activitiesTable`

- Implements a basic CRDT distributed counter.
- `id`: UUIDv5 generated from `${date}:${deviceId}`.
- Drops the traditional `UNIQUE(date)` constraint. Devices write to separate rows for any given date, and the UI queries them via `SUM(count) GROUP BY date`.

### `sensesTable` & `descriptionsTable`

- `senses` are synced Dictionary records with UUIDv7 identity, Entry ownership, name, and lifecycle timestamps.
- `descriptions` are synced Dictionary records with direct Entry ownership, nullable `senseId`, fixed Description Type, text, and lifecycle timestamps.
- The nullable Sense foreign key uses `ON DELETE SET NULL`, so ordinary Sense deletion preserves and detaches Descriptions. Explicit cascading deletion is controlled by the application.
- Sync does not merge Senses based on their names or semantic equivalence. Distinct offline Senses can remain as cross-device semantic duplicates.

### `instructionsTable`

- Reusable Instructions are shared SQLite records with an ID, optional name, text, and lifecycle timestamps. They Sync with the Dictionary content used for Description Generation, unlike device-local Provider Connections, configuration, and runtime Selected Models.

### Device-Local Provider Connections and Model Catalog

- Provider Connections are keyed by stable Provider ID; `<dataDir>/providers.json` stores one API key per configured Provider ID. Each device needs its own credentials. This file is not part of Sync or Mirroring.
- The Model Catalog has a bundled snapshot and an optional validated device-local version 2 cache at `<dataDir>/model-catalog.json` (`version`, `fetchedAt`, supported Providers, and Models with a derived `textGeneration: true` marker). A version 1 cache falls back to the bundled snapshot until explicitly refreshed. The cache is metadata for local Model browsing, not proof of account access; it is not part of Sync or Mirroring.
- None of these device-local records adds a table or column to the shared SQLite/Drizzle schema or requires a synced database migration.
