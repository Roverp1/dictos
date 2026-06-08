# Technical Plan: Web Client Initialization

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

To enable the Dictos web client while adhering to our local-first and Hexagonal Architecture principles, we must dismantle the monolithic `packages/adapters` package. Currently, this package bundles Node.js built-ins (`fs`, `path`) alongside database and HTTP logic. If imported into a Vite/React application, these Node.js dependencies will instantly crash the bundler's static analysis phase.

Our strategy is to split these adapters into granular, technology-specific packages. This allows the web client to safely import `adapters-local-storage` and `adapters-wasm-turso-sync` without touching the Node-specific `adapters-fs-storage` or `adapters-bun-turso-sync`. We will also implement a centralized `db-core` package to hold the Drizzle schema, migrations, and generic repository implementations, ensuring schema evolution is isolated from the specific runtime drivers.

For the web application itself, we will use Vite with React Router configured strictly as a client-side library (SPA mode, no SSR). This decision maximizes routing logic parity across the TUI, Web, and future Mobile clients, and acknowledges that framework-level data loaders provide zero performance benefit when data is fetched instantaneously from a local WASM Turso database.

## 2. Data Model & State Changes

There are no new domain entities introduced in this feature. The changes relate to how existing state interfaces are fulfilled in the browser.

### LocalStorage Mapping

The web client will fulfill the `@dictos/core` storage interfaces using the browser's `window.localStorage` API.

- **`local-state`**: Stores the device ID (e.g., `{"deviceId": "uuid"}`). Managed by `LocalStorageStateRepository`.
- **`session`**: Stores the authentication session (e.g., `{"token": "jwt"}`). Managed by `LocalStorageSessionRepository`.

### Database Schema Location

- All `drizzle` schema files, relationships, and the `drizzle.config.ts` will be moved into `@dictos/db-core`.
- The generated `migrations/` directory will reside exclusively in `@dictos/db-core`.

## 3. Interface Contracts & Boundaries

This refactor reorganizes existing implementations of ports defined in `@dictos/core`. The core interfaces (e.g., `SessionRepository`, `LocalStateRepository`) remain completely unchanged.

### Web Storage Adapters (`@dictos/local-storage`)

- **Class:** `LocalStorageSessionRepository`
  - **Implements:** `SessionRepository`
  - **Behavior:** Serializes/deserializes `AuthSession` objects to `window.localStorage.getItem('dictos_session')`. Returns `StorageError` if quota is exceeded or JSON parsing fails.
- **Class:** `LocalStorageStateRepository`
  - **Implements:** `LocalStateRepository`
  - **Behavior:** Serializes/deserializes `LocalState` objects to `window.localStorage.getItem('dictos_local_state')`. Generates a new UUID if none exists. Returns `StorageError` on failure.

### Pino Logger Refactor (`@dictos/pino-logger`)

- **Class:** `PinoLoggerAdapter`
  - **Implements:** `Logger`
  - **Change:** The constructor will no longer hardcode a file path string. It will accept an instantiated `pino.Logger` instance via Dependency Injection.
  - **Behavior:** Allows the TUI to inject a file-bound Pino instance, while the web client injects a console-bound Pino instance.

### Database Refactor Architecture

- **`@dictos/db-core`**: Exports Drizzle `schema`, `schema` types, and `repositories`. Repositories will accept a generic or explicitly typed Drizzle instance (agnostic of Bun vs. WASM).
- **`@dictos/bun-turso-sync`**: Imports `@tursodatabase/sync` (Node) and `@dictos/db-core`. Responsible only for instantiating the database connection and injecting it into the core repositories.
- **`@dictos/wasm-turso-sync`**: Imports `@tursodatabase/sync-wasm` and `@dictos/db-core`. Responsible only for instantiating the WASM database connection and injecting it into the core repositories.
