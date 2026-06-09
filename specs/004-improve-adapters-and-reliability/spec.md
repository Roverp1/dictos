# Specification: Improve Adapters and Reliability

**Status**: Draft | **Created**: June 08, 2026

## 1. The Problem (Why are we doing this?)

As Dictos grows, maintaining the reliability of data synchronization and storage across different platforms is becoming increasingly difficult. Currently, the database adapters (`bun-turso-sync` and `wasm-turso-sync`) suffer from several issues:
- **Poor Observability**: There is no structured logging. Debugging depends on scattered `console.log` statements, making it hard to trace sync failures or migration issues in production.
- **Fragile WASM Migrations**: The WASM client uses a manual, static string-based migration hack because it lacks access to the filesystem. This makes schema updates error-prone and disconnected from Drizzle's standard migration flow.
- **Manual Verification**: Sync logic (authentication, merging, and conflict resolution) is verified manually by running multiple app instances. This is slow and doesn't protect against silent data loss during development.

## 2. The Solution (What are we building?)

We are refactoring the database adapters to be more robust, observable, and testable. The solution consists of three pillars:
- **Vite-Native WASM Migrator**: A custom migration engine for the web client that uses Vite's `import.meta.glob` to bundle Drizzle SQL migrations directly into the application, enabling standard Drizzle migration tracking (`__drizzle_migrations`) without a filesystem.
- **Structured Logging**: Deep integration of the `@dictos/logger` into both adapters to provide high-fidelity traces of database initialization, migrations, and sync operations.
- **Automated Integration Testing**: A suite of tests that spin up real local database instances to verify that the `SyncPort` correctly handles data replication and Turso's "last-write-wins" conflict resolution.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Seamless Web Migration**
  Given a new version of the web app with schema changes, When the user opens the app, Then the Vite-bundled migrations are automatically applied to the local WASM database, and the progress is logged to the console.

- **Scenario: Observability-Driven Debugging**
  Given a sync failure occurs, When the developer opens the console, Then they see a structured log entry containing the exact operation that failed, the error message, and the Turso sync statistics (bytes sent/received) at the time of failure.

- **Scenario: Reliability Assurance**
  Given a change is made to the core sync logic, When the automated test suite runs, Then it verifies that data modified on two simulated devices merges correctly according to the defined conflict resolution rules.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] We are NOT building a generic migrator for all bundlers; the WASM solution is specifically optimized for Vite.
- [ ] We are NOT supporting backward compatibility for pre-migration-engine databases; all existing test data may be cleared.
- [ ] We are NOT building a UI for sync status or conflict resolution; observability remains at the log level for now.

## 5. Success Criteria (How do we know we are done?)

- [ ] `wasm-turso-sync` applies migrations using standard Drizzle `.sql` files bundled via Vite.
- [ ] `bun-turso-sync` and `wasm-turso-sync` emit structured logs for all major operations (init, migrate, sync, error).
- [ ] Automated integration tests successfully verify a bidirectional sync flow between two local instances.
- [ ] No `console.log` or `console.error` calls remain in the adapter packages.

## 6. Assumptions

- [ ] Assuming that Vite's `import.meta.glob` is available in the environment where `wasm-turso-sync` is consumed.
- [ ] Assuming that Turso's "last-write-wins" is the acceptable default conflict resolution strategy for all synced entities.
