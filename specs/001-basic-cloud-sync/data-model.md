# Data Model

## Central DB Entities (Shared)

### User Profile (`users`)
- `id`: integer (Primary Key, auto-increment)
- `username`: string (Unique)
- `email`: string (Unique)
- `passwordHash`: string
- `bio`: string (Optional)
- `avatarUrl`: string (Optional)
- `createdAt`: string (ISO 8601)
- `lastLoginAt`: string (ISO 8601, Optional)

### Central Captures Added (`central_captures_added`)
- `id`: integer (Primary Key)
- `userId`: integer (FK to users.id)
- `date`: string (YYYY-MM-DD)
- `count`: integer (Total additions recorded for the day)

## Local DB Entities (Personal)

### User Profile (`users`)
- `id`: integer (Primary Key, matches Central ID)
- `username`: string
- `email`: string
- `bio`: string (Optional)
- `avatarUrl`: string (Optional)

### Session (`session`)
- `id`: integer (Primary Key, Singleton = 1)
- `userId`: integer (FK to users.id)
- `token`: string (JWT)

### Personal Data (Synced natively via Turso)
- `captures`, `directories`, `definitions`, `prompts`, `captures_added` tables as defined in V1 schema, using native libSQL replication.
