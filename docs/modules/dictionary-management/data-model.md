# Data Model: Dictionary Management

**Parent Module**: [domain.md](./domain.md)

## Core Entities (`packages/core/src/models`)

```typescript
export interface Entry {
  id: number;
  text: string;
  folderId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export interface Description {
  id: number;
  text: string;
  entryId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
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
| `id`         | `int`            | PK                              | Auto-incremented ID |
| `name`       | `text`           | NOT NULL                        | Name of the folder |
| `parentId`   | `int`            | FK (`folders.id`) CASCADE       | Nullable root, self-referencing |
| `privacy`    | `text (enum)`    | NOT NULL, Default: "private"    | 'private', 'public', or 'unlisted' |
| `createdAt`  | `int (timestamp)`| NOT NULL                        | Creation timestamp |
| `modifiedAt` | `int (timestamp)`| NOT NULL                        | Last modification timestamp |

*Constraints: Unique composite index on `(name, parentId)`.*

### `entries`

Text fragments stored in folders.

| Column       | Type             | Constraints                     | Description |
| ------------ | ---------------- | ------------------------------- | ----------- |
| `id`         | `int`            | PK                              | Auto-incremented ID |
| `text`       | `text`           | NOT NULL                        | The capture text |
| `folderId`   | `int`            | FK (`folders.id`) CASCADE       | Target folder |
| `createdAt`  | `int (timestamp)`| NOT NULL                        | Creation timestamp |
| `modifiedAt` | `int (timestamp)`| NOT NULL                        | Last modification timestamp |

*Constraints: Unique composite index on `(text, folderId)`.*

### `descriptions`

Explanations attached to entries.

| Column       | Type             | Constraints                     | Description |
| ------------ | ---------------- | ------------------------------- | ----------- |
| `id`         | `int`            | PK                              | Auto-incremented ID |
| `entryId`    | `int`            | FK (`entries.id`) CASCADE       | Target entry |
| `text`       | `text`           | NOT NULL                        | The description content |
| `createdAt`  | `int (timestamp)`| NOT NULL                        | Creation timestamp |
| `modifiedAt` | `int (timestamp)`| NOT NULL                        | Last modification timestamp |
