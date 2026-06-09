# Technical Plan: Improve Adapters and Reliability

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

We will replace the ad-hoc migration logic in `WasmTursoClient` with a robust, Drizzle-compatible migrator that works in a Vite environment. This avoids the need for a filesystem by leveraging Vite's `import.meta.glob` to statically analyze and bundle SQL migration files and the Drizzle journal at build time. This strategy keeps the migration logic consistent across platforms while respecting the technical constraints of the browser.

To improve observability, we will systematically replace all `console` calls in `@dictos/bun-turso-sync` and `@dictos/wasm-turso-sync` with the `@dictos/logger` interface. We will adopt a "trace-first" approach, ensuring that every significant step of the database lifecycle (connection, migration application, sync start/end) emits a structured log entry with relevant context (e.g., CDC operation counts, network bytes).

For reliability, we will introduce integration tests using `bun test`. These tests will focus on the `SyncPort` implementations. By instantiating two clients representing different "devices" and having them sync against a common remote (or a local simulation), we can programmatically verify that data flows correctly and that conflict resolution (last-write-wins) behaves as expected.

## 2. Data Model & State Changes

No changes are being made to the domain data models. However, the WASM local database will now include the standard Drizzle migration tracking table.

### `__drizzle_migrations`

- **`id`** (`integer`): Primary key. Note: In a synced environment, this will be handled by Turso's row-level LWW. Since migrations are deterministic across devices, collisions on `id` for the same migration are safe.
- **`hash`** (`text`): SHA-256 hash of the migration file content (or a unique tag) to ensure integrity.
- **`created_at`** (`numeric`): Timestamp (from the Drizzle journal `when` field) indicating when the migration was applied.

## 3. Interface Contracts & Boundaries

### `migrateWasm` (Internal Utility)

This function will reside in `packages/wasm-turso-sync/src/migrator.ts`.

- **Input:**
  - `db`: `SqliteTursoDrizzleProxy`
  - `journal`: The parsed `_journal.json` object.
  - `migrationFiles`: A record mapping file paths to raw SQL strings (provided by Vite).
  - `logger`: `@dictos/logger` instance.
- **Output:** `Promise<void>`
- **Behavior/Errors:**
  1. Creates `__drizzle_migrations` table if missing.
  2. Fetches the latest applied migration from the DB.
  3. Compares with the `journal.entries` to find pending migrations.
  4. For each pending migration:
     - Splits SQL by `--> statement-breakpoint`.
     - Executes each statement.
     - Logs success or detailed failure (including the failing SQL).
     - Records the migration in `__drizzle_migrations`.

### `SyncPort` Implementation Updates

The `sync()` method in both `BunTursoClient` and `WasmTursoClient` already returns the correct `SyncResult` shape. The focus will be on ensuring these stats are accurately populated using the Turso `stats()` API and logged effectively.
