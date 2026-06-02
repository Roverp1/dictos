# Data Model: Sync

**Parent**: [Sync Domain](./domain.md)

## Core Entities

### LocalState (Device Config)
Represents the persistent, device-specific configuration stored outside the synced database.
- `deviceId`: Persistent UUIDv4 identifying the physical installation. Used to namespace activity CRDTs.

### AuthSession (Thin Session)
Represents the temporary authentication secrets.
- `userId`: Link to the synced `User` profile.
- `token`: Central API JWT.
- `turso`: Cloud database credentials (`url`, `token`).

### SyncResult
Provides actionable metrics to the UI regarding the sync operation.
- `pushedLocalChanges`: `boolean`
- `pulledRemoteChanges`: `boolean`

## Database Schemas (SQLite / Drizzle)

### `foldersTable` & `entriesTable`
- Primary Keys (`id`) are generated locally via deterministic UUIDv5 (e.g., `parentId:name` for folders) to allow identical offline creations on separate devices to merge natively on Turso without conflict.

### `activitiesTable`
- Implements a basic CRDT distributed counter.
- `id`: UUIDv5 generated from `${date}:${deviceId}`.
- Drops the traditional `UNIQUE(date)` constraint. Devices write to their own isolated rows for any given date, and the UI queries them via `SUM(count) GROUP BY date`.
