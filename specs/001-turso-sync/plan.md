# Technical Plan: Turso Cross-Device Synchronization

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

To support Turso's native push/pull sync while preserving the application's existing Dependency Injection (DI) structure, we will migrate from the standard `drizzle-orm/libsql` adapter to the `drizzle-orm/sqlite-proxy` adapter, utilizing the new `@tursodatabase/sync` SDK.

Currently, the application instantiates a single Drizzle `db` instance and passes it to all repositories. To avoid rebuilding the entire service tree when a user logs in and receives Turso credentials, we will use a **Mutable Connection Container** behind the SQLite Proxy.

The proxy's query callback will execute SQL against a `SyncClientContainer`. When a user logs in, we will invoke a `connectRemote(url, token)` method on the database adapter. This method will:

1. Safely close the active local-only `@tursodatabase/sync` client.
2. Instantiate a new `@tursodatabase/sync` client configured with the remote Turso URL and Auth Token.
3. Immediately trigger `client.push()` to merge any offline data created by the user into their newly provisioned cloud database.

All Drizzle repositories will seamlessly begin routing queries to the newly synced client without needing re-initialization.

Furthermore, to prevent primary key collisions during offline multi-device usage, we will drop the existing schema and migrate all integer IDs to locally-generated UUIDs using Drizzle's `$defaultFn(() => crypto.randomUUID())`.

## 2. Data Model & State Changes

### SQLite Schema (Drizzle)

All tables will be recreated to drop auto-incrementing integers.

- **`foldersTable`**:
  - `id` (`text`): Primary Key, UUIDv4.
  - `parentId` (`text`): Foreign Key, UUIDv4.
- **`entriesTable`**:
  - `id` (`text`): Primary Key, UUIDv4.
  - `folderId` (`text`): Foreign Key, UUIDv4.
- **`descriptionsTable`**:
  - `id` (`text`): Primary Key, UUIDv4.
  - `entryId` (`text`): Foreign Key, UUIDv4.

### Client State (Session Persistence)

- The TUI must persist the `turso.url` and `turso.token` alongside the application session JWT. When the app boots, it should check for these credentials and initialize the remote sync client immediately if they exist.

## 3. Interface Contracts & Boundaries

### `Database Connection Manager` (Adapter Layer)

A new wrapper in `@dictos/adapters/db/libsql-adapter/src/db.ts` to manage connection state and sync lifecycle.

- **Method:** `connectRemote(url: string, token: string): Promise<void>`
  - _Behavior:_ Swaps the local client for a synced client and triggers a bootstrap push.
- **Method:** `sync(): Promise<void>`
  - _Behavior:_ Manually invokes `.push()` and `.pull()` on the active sync client. Throws an error if the user is not authenticated (client is local-only).
- **Method:** `disconnectRemote(): Promise<void>`
  - _Behavior:_ For logouts. Closes the synced client and falls back to a fresh local-only client.

### `POST /auth/register` & `POST /auth/login` (Elysia Backend)

- **Output Shape:**
  ```typescript
  {
    user: { id: string, email: string },
    token: string, // App JWT
    turso: {
      url: string,   // e.g., libsql://user-xyz.turso.io
      token: string  // Database-scoped auth token
    }
  }
  ```
- **Behavior:** Upon registration, the server uses the Turso Platform API (via `TURSO_PLATFORM_TOKEN`) to provision a new database and generates a scoped token. On login, it generates a fresh scoped token for the existing database.

