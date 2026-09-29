# Data Model: Sync

**Parent**: [Sync Domain](./domain.md)

## Core Entities

### LocalState (Device Config)

Represents the persistent, device-specific configuration stored outside the synced database.

- `deviceId`: Persistent UUIDv4 identifying the physical installation. Used to namespace activity CRDTs.
- `selectedModel`: `SelectedModel | null`, a device-local `{ providerId, modelId }` pair for Description Generation; `null` means no Model is selected. The filesystem adapter persists it beside `deviceId` in `<dataDir>/local-state.json`. Selection updates preserve the existing `deviceId`; an existing file with only `deviceId` reads as unselected, and an explicit reset clears the selection and creates a new device ID. The browser local-state adapter uses `dictos_local_state` in local storage instead of this file.

### AuthSession (Thin Session)

Represents the temporary authentication secrets.

- `userId`: Link to the synced `User` profile.
- `token`: Central API JWT.
- `turso`: Cloud database credentials (`url`, `token`).

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

- Reusable Instructions are shared SQLite records with an ID, optional name, text, and lifecycle timestamps. They Sync with the Dictionary content used for Description Generation, unlike the device-local Provider Connection and Selected Model.

### Device-Local Provider Connections and Model Catalog

- Provider Connections are keyed by stable Provider ID; `<dataDir>/providers.json` stores one API key per configured Provider ID. Each device needs its own credentials. This file is not part of Sync or Mirroring.
- The Model Catalog has a bundled snapshot and an optional validated device-local version 2 cache at `<dataDir>/model-catalog.json` (`version`, `fetchedAt`, supported Providers, and Models with a derived `textGeneration: true` marker). A version 1 cache falls back to the bundled snapshot until explicitly refreshed. The cache is metadata for local Model browsing, not proof of account access; it is not part of Sync or Mirroring. The Selected Model in `local-state.json` is also neither synced nor mirrored.
- None of these device-local records adds a table or column to the shared SQLite/Drizzle schema or requires a synced database migration.
