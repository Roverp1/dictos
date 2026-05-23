# Central API Contracts

## Auth
- `POST /api/auth/register`: `{ username, email, password }` 
  - Action: Creates central user record.
  - Response: `201 { token }`
- `POST /api/auth/login`: `{ email, password }` 
  - Response: `200 { token }`

## Central Sync (Outbox processing)
- `POST /api/sync/push`: Pushes a batch of outbox updates (e.g., activity aggregates) to the central DB.
  - Request: `[{ tableName, recordId, operation, timestamp }]` (Client fetches current count locally before pushing).
  - Response: `200 { processed: number }`

## Social
- `GET /api/social/stats`: Fetches leaderboard or friend stats.
  - Response: `200 { stats: [...] }`
