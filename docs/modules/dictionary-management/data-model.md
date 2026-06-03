# Data Model: Dictionary Management

**Parent Module**: [domain.md](./domain.md)

## Core Entities (`packages/core/src/models`)

```typescript
export interface Entry {
  id: string;
  text: string;
  folderId: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface Description {
  id: string;
  text: string;
  entryId: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  privacy: "private" | "public" | "unlisted";
  createdAt: Date;
  modifiedAt: Date;
}
```

## Database Tables (`packages/adapters/db/schema`)

### `folders`

Nested containers for entries.

| Column       | Type             | Constraints                     | Description |
| ------------ | ---------------- | ------------------------------- | ----------- |
| `id`         | `text`           | PK                              | Deterministic UUIDv5 (`parentId:name`) |
| `name`       | `text`           | NOT NULL                        | Name of the folder |
| `parentId`   | `text`           | FK (`folders.id`)               | Nullable root, self-referencing |
| `privacy`    | `text (enum)`    | NOT NULL, Default: "private"    | 'private', 'public', or 'unlisted' |
| `createdAt`  | `int (timestamp)`| NOT NULL                        | Creation timestamp |
| `modifiedAt` | `int (timestamp)`| NOT NULL                        | Last modification timestamp |

*Note: Native `UNIQUE` constraints are omitted. Duplicate offline creations merge seamlessly during Turso sync due to deterministic UUIDv5 primary keys.*

### `entries`

Text fragments stored in folders.

| Column       | Type             | Constraints                     | Description |
| ------------ | ---------------- | ------------------------------- | ----------- |
| `id`         | `text`           | PK                              | Deterministic UUIDv5 (`folderId:text`) |
| `text`       | `text`           | NOT NULL                        | The capture text |
| `folderId`   | `text`           | FK (`folders.id`) CASCADE       | Target folder |
| `createdAt`  | `int (timestamp)`| NOT NULL                        | Creation timestamp |
| `modifiedAt` | `int (timestamp)`| NOT NULL                        | Last modification timestamp |

*Note: Native `UNIQUE` constraints are omitted to prevent sync crashes. Duplicate creations resolve via UUIDv5 merge.*

### `descriptions`

Explanations attached to entries.

| Column       | Type             | Constraints                     | Description |
| ------------ | ---------------- | ------------------------------- | ----------- |
| `id`         | `text`           | PK                              | UUIDv7 |
| `entryId`    | `text`           | FK (`entries.id`) CASCADE       | Target entry |
| `text`       | `text`           | NOT NULL                        | The description content |
| `createdAt`  | `int (timestamp)`| NOT NULL                        | Creation timestamp |
| `modifiedAt` | `int (timestamp)`| NOT NULL                        | Last modification timestamp |
