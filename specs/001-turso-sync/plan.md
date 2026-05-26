# Technical Plan: Turso Cross-Device Synchronization

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

To support Turso's native push/pull sync while preserving the Hexagonal Architecture and existing Dependency Injection (DI) structure, we will migrate from the standard `drizzle-orm/libsql` adapter to the `drizzle-orm/sqlite-proxy` adapter, utilizing the new `@tursodatabase/sync` SDK.

Instead of a simple factory function, the database adapter (`db.ts`) will be refactored into a stateful class (`BunTursoClient`). This class has two responsibilities:
1. It exposes the stable `db` property (the Drizzle ORM instance using `sqlite-proxy`) so repositories can perform queries.
2. It implements the `SyncPort`, wrapping a mutable `@tursodatabase/sync` client container.

In the Core domain, we will introduce a `SyncService` (defined by an interface) that depends on this `SyncPort`. When a user logs in (via `AuthService`), the UI will pass the new Turso credentials to `syncService.connectRemote()`. The underlying manager will safely close the local-only client, open the remote client, and push offline data to the cloud. Because the Drizzle `db` instance remains constant, the repositories are completely unaffected by the connection swap under the hood.

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

- The existing `AuthSession` model must be updated to include the `turso` configuration object so it is persisted to the local session storage, allowing the app to reconnect the sync client immediately on startup.

## 3. Interface Contracts & Boundaries

### Core Domain Interfaces

```typescript
// @packages/core/src/models/user.ts (or auth.ts)
export interface AuthSession {
  user: { id: string; email: string };
  token: string;
  turso?: {
    url: string;
    token: string;
  };
}

// @packages/core/src/ports/outbound/sync-port.ts
export interface SyncPort {
  /** 
   * Safely swaps the local client for a remote synced client 
   * and pushes any existing local data to the cloud database.
   */
  connectRemote(url: string, token: string): Promise<void | DbError>;
  
  /** 
   * Manually triggers push and pull for the remote database.
   * Returns an error if called while in local-only mode (unauthenticated).
   */
  sync(): Promise<void | DbError | Error>; // Replace 'Error' with specific SyncError
  
  /** 
   * Closes the remote connection and reverts to local-only mode.
   * Used when a user logs out.
   */
  disconnectRemote(): Promise<void | DbError>;
}
```

### Core Services

```typescript
// @packages/core/src/services/sync-service.ts
/** 
 * Defines the public API for the SyncService. 
 * The concrete class will implement this interface and orchestrate 
 * between the SyncPort and SessionRepository (if needed).
 */
export interface ISyncService {
  /** Intended to be called after a successful login or app bootstrap */
  connectRemote(url: string, token: string): Promise<void | DbError>;

  /** Invoked by the UI "Sync Now" action */
  sync(): Promise<void | DbError | Error>;

  /** Intended to be called during logout */
  disconnectRemote(): Promise<void | DbError>;
}
```

### Adapter Layer

```typescript
// @packages/adapters/db/clients/bun-turso-client.ts
import { SyncPort } from "@dictos/core";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../../schema/schema";

/**
 * The interface for the concrete implementation of the SyncPort for Bun.
 * Manages the mutable Turso client and exposes the stable Drizzle proxy.
 */
export interface IBunTursoClient extends SyncPort {
  /** The stable Drizzle instance passed to repositories */
  readonly db: LibSQLDatabase<typeof schema>;
}
```

### Elysia Backend APIs

```typescript
// POST /auth/register & POST /auth/login Responses
export interface AuthResponseDto {
  user: { id: string; email: string };
  token: string; // App JWT
  turso: {
    url: string;   // e.g., libsql://user-xyz.turso.io
    token: string; // Database-scoped auth token
  };
}
```