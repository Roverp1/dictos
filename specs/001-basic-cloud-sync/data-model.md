# Data Model

## Central DB Entities (Shared)

### User Profile

- `id`: string
- `username`: string
- `email`: string
- `createdAt`: string

### Central Captures Added (Aggregate)

- `id`: string
- `userId`: string
- `date`: string (YYYY-MM-DD)
- `count`: integer (Total additions ever recorded)

## Local DB Entities (Personal)

### Session / Token

- `jwt`: string (stored locally for auth)

### Sync Queue / Outbox (For Central DB Sync)

- `id`: string
- `tableName`: string (e.g., 'activity_aggregates')
- `recordId`: string (e.g., '2026-05-16')
- `operation`: 'INSERT' | 'UPDATE' | 'DELETE'
- `timestamp`: integer
- _Note_: No JSON payload. The sync worker reads the current state from the local DB before pushing.

### Personal Data (Synced natively via Turso)

- `captures`, `directories`, `definitions`, `prompts`, `activity_aggregates` tables as defined in V1.
