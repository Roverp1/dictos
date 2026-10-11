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
  senseId: string | null;
  type: "misc" | "translation" | "definition" | "example";
  createdAt: Date;
  modifiedAt: Date;
}

export interface Sense {
  id: string;
  entryId: string;
  name: string;
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

## Database Tables (`packages/db-core/src/schema/schema.ts`)

### `folders`

Nested containers for entries.

| Column       | Type              | Constraints                  | Description                            |
| ------------ | ----------------- | ---------------------------- | -------------------------------------- |
| `id`         | `text`            | PK                           | Deterministic UUIDv5 (`parentId:name`) |
| `name`       | `text`            | NOT NULL                     | Name of the folder                     |
| `parentId`   | `text`            | FK (`folders.id`)            | Nullable root, self-referencing        |
| `privacy`    | `text (enum)`     | NOT NULL, Default: "private" | 'private', 'public', or 'unlisted'     |
| `createdAt`  | `int (timestamp)` | NOT NULL                     | Creation timestamp                     |
| `modifiedAt` | `int (timestamp)` | NOT NULL                     | Last modification timestamp            |

_Note: Native `UNIQUE` constraints are omitted. Duplicate offline creations merge seamlessly during Turso sync due to deterministic UUIDv5 primary keys._

### `entries`

Text fragments stored in folders.

| Column       | Type              | Constraints               | Description                            |
| ------------ | ----------------- | ------------------------- | -------------------------------------- |
| `id`         | `text`            | PK                        | Deterministic UUIDv5 (`text:folderId`) |
| `text`       | `text`            | NOT NULL                  | Entry text                             |
| `folderId`   | `text`            | FK (`folders.id`) CASCADE | Target folder                          |
| `createdAt`  | `int (timestamp)` | NOT NULL                  | Creation timestamp                     |
| `modifiedAt` | `int (timestamp)` | NOT NULL                  | Last modification timestamp            |

_Note: Native `UNIQUE` constraints are omitted to prevent sync crashes. Duplicate creations resolve via UUIDv5 merge._

### `descriptions`

Typed text attached directly to Entries and optionally grouped under Senses.

| Column       | Type              | Constraints                          | Description                                       |
| ------------ | ----------------- | ------------------------------------ | ------------------------------------------------- |
| `id`         | `text`            | PK                                   | UUIDv7                                            |
| `entryId`    | `text`            | FK (`entries.id`) CASCADE            | Target entry                                      |
| `senseId`    | `text`            | Nullable FK (`senses.id`) SET NULL   | Optional Sense grouping                           |
| `type`       | `text (enum)`     | NOT NULL, default `misc`, enum check | `misc`, `translation`, `definition`, or `example` |
| `text`       | `text`            | NOT NULL                             | The description content                           |
| `createdAt`  | `int (timestamp)` | NOT NULL                             | Creation timestamp                                |
| `modifiedAt` | `int (timestamp)` | NOT NULL                             | Last modification timestamp                       |

Indexes exist on `entryId` and `senseId`. `senseId` never replaces direct `entryId` ownership.

### `senses`

Named interpretations that group related Descriptions for one Entry.

| Column       | Type              | Constraints               | Description                 |
| ------------ | ----------------- | ------------------------- | --------------------------- |
| `id`         | `text`            | PK                        | UUIDv7                      |
| `entryId`    | `text`            | FK (`entries.id`) CASCADE | Owning Entry                |
| `name`       | `text`            | NOT NULL                  | User-editable Sense name    |
| `createdAt`  | `int (timestamp)` | NOT NULL                  | Creation timestamp          |
| `modifiedAt` | `int (timestamp)` | NOT NULL                  | Last modification timestamp |

An index exists on `entryId`. There is no uniqueness constraint on `(entryId, name)` because duplicate Sense names are valid.

### `activities`

Daily Activity counts use a separate deterministic identity per device and UTC date.

| Column  | Type   | Constraints           | Description                            |
| ------- | ------ | --------------------- | -------------------------------------- |
| `id`    | `text` | PK                    | Deterministic UUIDv5 (`date:deviceId`) |
| `date`  | `text` | NOT NULL              | UTC date in `YYYY-MM-DD` format        |
| `count` | `int`  | NOT NULL, default `1` | Action count for that device and date  |

### Reviewed Save record ownership

Screen saves reuse `folders`, `entries`, `senses`, `descriptions`, and `activities`. No table, column, or migration is added. Drafts and Sense suggestion previews are not persisted by suggestion or generation.

`entryIdFor()` in `packages/db-core/src/repositories/entry-write.ts` derives the Entry ID from exact reviewed text and the root Folder ID using the existing Entry namespace. `insertOrReuseEntry()` inserts with conflict handling, then reads the existing row if that identity already exists. The reviewed-save adapter requires that row's text and Folder to match the request; an Entry renamed under its old ID produces a `DbError` and no new records. Nonblank text is stored unchanged; whitespace differences affect Entry identity.

| Save mode                                                     | Sense                          | Captured Description                                        | Right-column Descriptions                                                  |
| ------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Center (`kind: "entry"`)                                      | None created                   | Optional `misc`, `entryId` set, `senseId: null`             | None saved                                                                 |
| Ordinary right (`kind: "sense"`, `includeDescription: false`) | New UUIDv7, owned by the Entry | None saved                                                  | Nonblank text with its reviewed Type, all owned by the Entry and new Sense |
| Inclusive right (`kind: "sense"`, `includeDescription: true`) | New UUIDv7, owned by the Entry | Optional `misc`, owned by the Entry and that same new Sense | Same ownership as ordinary right Save                                      |

Each saved Description has its own UUIDv7. Duplicate Sense names and multiple Descriptions of one Type are valid. Empty slots produce no rows. Right Save always creates a Sense, even if the Entry already has a Sense with the same name.

`incrementEntrySaveActivity()` adds one to the current device's daily Activity count for each successful Save, including Entry reuse. That increment shares the transaction with all selected records; rollback leaves no partial records or Activity increment.

## Headless UI State (`@dictos/react`)

This state is not persisted. It describes the current client interaction model for the Dictionary view.

```typescript
type TreeItemReference =
  { type: "entry"; id: string } | { type: "folder"; id: string };

type PreviewPaneContent =
  | { kind: "empty" }
  | { kind: "folder"; folderId: string; items: TreeItem[] }
  | { kind: "entry"; entryId: string; descriptions: Description[] };
```

The headless UI stores full `TreeItem` snapshots for the current folder and preview pane, while long-lived selection and context menu state use typed references. Active Entry state is split between `activeEntryId` and `activeEntryDescriptions` so clients can render opened Entry content separately from cursor-driven previews.

Notifications are not part of persisted Dictionary state. `@dictos/react` emits Notification intent through the injected `Notifier`, and each client renders that intent using its platform-native Notification system.
