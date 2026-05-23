# Data Model: [DOMAIN_NAME]

**Parent Module**: [domain.md](./domain.md)

<!--
  ACTION REQUIRED: Define the exact database schemas, global state shapes, and core entities.
-->

## Core Entities (`packages/core`)

<!--
  Define the pure domain entities used in business logic.
-->

```typescript
// e.g.
// export type Capture = {
//   id: string;
//   name: string;
//   directoryId: string | null;
// }
```

## Database Tables (`packages/adapters`)

<!--
  Define the persistence layer schema.
-->

### `[TABLE_NAME]`

[Description, e.g., `captures` table managed via Drizzle ORM in Turso.]

| Column         | Type     | Constraints               | Description |
| -------------- | -------- | ------------------------- | ----------- |
| `[FIELD_NAME]` | `[TYPE]` | `[e.g. PK, FK, NOT NULL]` | `[NOTES]`   |

## Global State (Clients)

<!--
  Define how clients store this data in memory.
-->

- `[STATE_STORE]`: [Description, e.g., Zustand store `useDictionaryStore` tracking `activeCaptureId` and `capturesList`.]
