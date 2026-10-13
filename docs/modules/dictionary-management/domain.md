# Domain: Dictionary Management

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Oct 11, 2026

## Module Responsibility

Responsible for managing personal Dictionary content: Entries, typed Descriptions, Senses, and Folders. A Sense is a named interpretation of one Entry that groups its related Descriptions. The module preserves quick Description capture by allowing a Description to remain unassigned.

## Core Workflows

### Creating an Entry

1. The TUI application invokes the `createEntry` method on the `EntryService` (`packages/core/src/services/entry-service.ts`).
2. `EntryService` validates the domain rules (e.g., text must not be empty, `folderId` must be provided) using `validateNewEntry`.
3. Upon validation success, `EntryService` calls the `save()` method on the `EntryRepository` port.
4. The concrete SQLite adapter (`packages/db-core`) executes an atomic transaction that generates a deterministic UUIDv5 (preventing sync conflicts), inserts the Entry via Drizzle ORM, and simultaneously increments the daily Activity CRDT.

### Saving reviewed screen text

The Command Client resolves the root Folder and passes the current editor text to `ScreenEntrySaveService.save()`. Save requires no Model or Instruction. Suggesting Senses and generating drafts write nothing to the Dictionary.

All three Save modes insert or reuse the root Entry by its deterministic UUIDv5, derived from exact Entry text and the root Folder ID:

| Save mode            | Records saved with the Entry                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Center Save Entry    | Optional nonblank captured Description as an unassigned `misc` Description. Sense and right-column drafts are ignored.                                    |
| Ordinary right Save  | A new Sense and every nonblank right-column Description under its displayed Description Type. Captured context is excluded, even when generation used it. |
| Inclusive right Save | The same Sense and typed Descriptions, plus optional nonblank captured text as a `misc` Description belonging to that new Sense.                          |

Both right Save modes require a nonblank Sense name and at least one nonblank typed Description. Captured text alone cannot satisfy that requirement. Empty or whitespace-only Description slots are ignored. Validation uses trimming only to detect blank text; nonblank Entry text, Sense names, and Description text retain their reviewed whitespace and line breaks exactly.

If an existing Entry under the derived identity has different text or Folder ownership, Save returns a conflict as `DbError` without attaching new records. This protects an Entry that was renamed while retaining its old deterministic ID.

Every right Save creates a fresh Sense identity. Duplicate Sense names are valid; Save never silently reuses a Sense by name. Multiple Descriptions of the same Type remain valid, including a typed `misc` Description alongside the inclusive captured `misc`.

`SqliteScreenEntrySaveRepository.commit()` writes the chosen records and increments Activity once in the same transaction, including when it reuses an existing Entry. SQL failures and post-write invariant failures roll back all writes, including Activity. The caller receives a `DbError` with no partial new Entry, Sense, or Description set. These modes use the existing Dictionary tables and require no schema change or migration.

### Managing Folders

1. Clients use `FolderService` to manage the dictionary hierarchy dynamically.
2. The UI maintains a navigation stack starting from the root (`getRootFolder()`).
3. When viewing a folder, it selectively fetches its immediate contents via `getSubFolders(parentId)` and `getEntriesInFolder(folderId)` rather than loading the entire tree at once.
4. Creation and renaming enforce domain rules (e.g., folder name cannot be empty and cannot contain slashes). IDs are generated deterministically to allow seamless offline merging.

### Managing Descriptions

1. Clients use `DescriptionService` to create, retrieve, update, assign, detach, and delete Descriptions for an Entry.
2. Every Description has one fixed Description Type: `misc`, `translation`, `definition`, or `example`. Creation defaults to `misc`.
3. Description text cannot be empty. A Description continues to belong directly to its Entry whether or not it belongs to a Sense.
4. Assigning a Description checks that the Description and Sense belong to the same Entry. Moving an assigned Description to another Entry is rejected until it is detached.
5. A Sense can contain multiple Descriptions of the same Description Type.

### Managing Senses

1. Clients use `SenseService` to create, list, rename, and delete Senses for an Entry.
2. A Sense name cannot be empty. Names are user-editable and are not unique; Sense identity, not repeated name text, groups Descriptions.
3. Deleting a Sense normally detaches its Descriptions and preserves their text and Description Types.
4. Explicit cascading deletion removes the Sense and its assigned Descriptions in one operation.

## Key Decisions & Trade-offs

- **Strict Validations**: Input validation is handled purely within the domain entities (`models/entry.ts`, `models/folder.ts`). They return union error types (e.g., `ValidationError`) using the `errore`.
- **Cascading Deletions (Hybrid Approach)**: Deleting an Entry cascades to its Descriptions natively via SQLite `ON DELETE CASCADE` constraints. However, because the TursoDB engine suffers from a stack overflow bug when processing self-referential cascading deletes, **Folders are deleted via an application-level Breadth-First Search (BFS)** traversing from the bottom of the tree upwards inside a database transaction.
- **Deterministic UUIDv5 over Constraints**: Instead of relying on SQLite `UNIQUE` constraints to enforce data integrity (which crash the Turso replication engine during split-brain merges), we enforce identity via UUIDv5. If two devices create an identical folder or entry offline, they generate the same PK, and the sync engine silently merges them.
- **Optional Sense Grouping**: Senses organize an Entry's Descriptions without replacing direct Entry ownership. This keeps unstructured quick saves valid while establishing the future one-Sense-to-one-note boundary for Export.
- **Atomic Generated Content**: Accepted Description Generation proposals use a dedicated persistence port. Creating or reusing the Sense, assigning an unassigned source Description, and inserting generated Descriptions succeed or roll back together.
- **Reviewed Screen Saves**: Current editor text determines the records written. One persistence port owns Entry reuse, new Sense creation, Description inserts, and Activity; generation and draft history remain outside that transaction.

## Known Edge Cases & Constraints

- Because `UNIQUE` constraints were removed to support offline-first sync, the repository adapters (e.g., `SqliteFolderRepository`, `SqliteEntryRepository`) MUST use `.onConflictDoNothing()` or `.onConflictDoUpdate()` to prevent localized UI crashes if a user double-submits a creation request.
- Separate devices can create semantically duplicate Senses while offline. Duplicate names are valid and are not merged by text equality.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
- [Description Generation](../description-generation/domain.md)
- [ADR 0012: Use a Standalone Screen Review Client](../../adr/0012-use-a-standalone-screen-review-client.md)
