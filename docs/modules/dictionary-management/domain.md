# Domain: Dictionary Management

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Jun 2, 2026

## Module Responsibility

Responsible for managing personal dictionary content: `Entries` (raw text), `Descriptions` (explanations/translations), and `Folders` (organization). It ensures pure domain logic is isolated from database persistence by leveraging Hexagonal Architecture, strictly enforcing data integrity like valid folder naming, and utilizing CRDT-like patterns for offline synchronization.

## Core Workflows

### Creating an Entry

1. The TUI application invokes the `createEntry` method on the `EntryService` (`packages/core/src/services/entry-service.ts`).
2. `EntryService` validates the domain rules (e.g., text must not be empty, `folderId` must be provided) using `validateNewEntry`.
3. Upon validation success, `EntryService` calls the `save()` method on the `EntryRepository` port.
4. The concrete SQLite adapter (`packages/adapters/db`) executes an atomic transaction that generates a deterministic UUIDv5 (preventing sync conflicts), inserts the Entry via Drizzle ORM, and simultaneously increments the daily Activity CRDT.

### Managing Folders

1. Clients use `FolderService` to manage the dictionary hierarchy dynamically.
2. The UI maintains a navigation stack starting from the root (`getRootFolder()`).
3. When viewing a folder, it selectively fetches its immediate contents via `getSubFolders(parentId)` and `getEntriesInFolder(folderId)` rather than loading the entire tree at once.
4. Creation and renaming enforce domain rules (e.g., folder name cannot be empty and cannot contain slashes). IDs are generated deterministically to allow seamless offline merging.

### Managing Descriptions

1. Clients use `DescriptionService` to create or retrieve definitions for a specific `Entry`.
2. Validations ensure description text is not empty and is tied to a valid `entryId`.
3. Creating a description delegates to `DescriptionRepository.save()`.

## Key Decisions & Trade-offs

- **Strict Validations**: Input validation is handled purely within the domain entities (`models/entry.ts`, `models/folder.ts`). They return union error types (e.g., `ValidationError`) using the `errore`.
- **Cascading Deletions (Hybrid Approach)**: Deleting an Entry cascades to its Descriptions natively via SQLite `ON DELETE CASCADE` constraints. However, because the TursoDB engine suffers from a stack overflow bug when processing self-referential cascading deletes, **Folders are deleted via an application-level Breadth-First Search (BFS)** traversing from the bottom of the tree upwards inside a database transaction.
- **Deterministic UUIDv5 over Constraints**: Instead of relying on SQLite `UNIQUE` constraints to enforce data integrity (which crash the Turso replication engine during split-brain merges), we enforce identity via UUIDv5. If two devices create an identical folder or entry offline, they generate the same PK, and the sync engine silently merges them.

## Known Edge Cases & Constraints

- Because `UNIQUE` constraints were removed to support offline-first sync, the repository adapters (e.g., `SqliteFolderRepository`, `SqliteEntryRepository`) MUST use `.onConflictDoNothing()` or `.onConflictDoUpdate()` to prevent localized UI crashes if a user double-submits a creation request.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
