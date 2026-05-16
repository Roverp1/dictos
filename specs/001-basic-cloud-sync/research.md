# Phase 0: Research & Decisions

## Database Architecture: Dual libSQL Architecture

- **Decision**: Use libSQL (Turso) for both personal databases and the central shared database.
- **Rationale**: Keeps the tech stack unified (SQLite/Drizzle everywhere).
  - **Personal DBs**: Isolated database per user for captures/definitions, synced natively via Turso SDK.
  - **Central DB**: Shared database for users, friends, and shared/public data (initially activity aggregates).

## Synchronization Mechanism: Native + Outbox

- **Decision**:
  1. Use **Native Turso Sync** (`@libsql/client` with `offline: true`) for personal data.
  2. Use the **Outbox Pattern** to sync shared data (activity aggregates) to the Central DB via REST API.
- **Rationale**:
  - Personal data requires full multi-device bidirectional sync (free with Turso).
  - Central data requires secure aggregation from millions of clients into one shared DB (requires API-mediated Outbox).

## Outbox Mechanism (State-Based & Scalable)

- **Decision**:
  - The `outbox` table stores `tableName`, `recordId`, and `operation`.
  - For **Activity Aggregates** (e.g., `captures_added`), it is additive-only. Deletion of local captures does not decrement the central count.
  - The design remains compatible with future **Entity Sync** (like public directories).
- **Rationale**: Simplifies the initial aggregate sync while providing a consistent path for syncing more complex entities later.

## Multi-Device Outbox Coordination

- **Decision**: The `outbox` table resides in the **Personal DB** and is synced natively via Turso.
- **Rationale**: Allows devices to share a "To-Do list," preventing redundant Central API updates once one device succeeds.
