# Domain: Dictionary Management

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: May 24, 2026

## Module Responsibility

Responsible for managing personal dictionary content: `Entries` (raw text), `Descriptions` (explanations/translations), and `Folders` (organization). It ensures pure domain logic is isolated from database persistence by leveraging Hexagonal Architecture, strictly enforcing data integrity like unique entry texts per folder and valid folder naming.

## Core Workflows

### Creating an Entry

1. The TUI application invokes the `createEntry` method on the `EntryService` (`packages/core/src/services/entry-service.ts`).
2. `EntryService` validates the domain rules (e.g., text must not be empty, `folderId` must be valid positive integer) using `validateNewEntry`.
3. Upon validation success, `EntryService` calls the `save()` method on the `EntryRepository` port.
4. The concrete SQLite adapter (`packages/adapters/db`) executes the `INSERT` SQL query via Drizzle ORM.

### Managing Folders

1. Clients use `FolderService` to manage the dictionary hierarchy dynamically.
2. The UI maintains a navigation stack starting from the root (`getRootFolder()`).
3. When viewing a folder, it selectively fetches its immediate contents via `getSubFolders(parentId)` and `getEntriesInFolder(folderId)` rather than loading the entire tree at once.
4. Creation and renaming enforce domain rules (e.g., folder name cannot be empty and cannot contain slashes).

### Managing Descriptions

1. Clients use `DescriptionService` to create or retrieve definitions for a specific `Entry`.
2. Validations ensure description text is not empty and is tied to a valid `entryId`.
3. Creating a description delegates to `DescriptionRepository.save()`.

## Key Decisions & Trade-offs

- **Strict Validations**: Input validation is handled purely within the domain entities (`models/entry.ts`, `models/folder.ts`). They return union error types (e.g., `ValidationError`) using the `errore`.
- **Cascading Deletions**: Deleting a Folder cascades to its Entries, and deleting an Entry cascades to its Descriptions. This is currently enforced at the SQLite database layer (using `ON DELETE CASCADE` constraints).

## Known Edge Cases & Constraints

- Entry text must be unique within a specific Folder. This is enforced at the database level via a composite unique constraint.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
