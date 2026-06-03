# Contracts & Interfaces: Dictionary Management

**Parent Module**: [domain.md](./domain.md)

## Hexagonal Ports (`packages/core/src/ports/outbound`)

The domain relies on these interfaces to persist data, abstracting away the concrete libSQL/Drizzle implementation:

- `FolderRepository`: Defines methods like `save()`, `findRoot()`, `findAll()`, `findByParentId()`, `update()`, and `delete()`.
- `EntryRepository`: Defines methods like `save()`, `findById()`, `findByFolder()`, `update()`, and `delete()`.
- `DescriptionRepository`: Defines methods like `save()`, `findByEntry()`, `update()`, and `delete()`.

## Core Services (`packages/core/src/services`)

These services expose the pure domain logic use-cases to the clients (e.g., the TUI):

- `FolderService`: Handles validation and execution for creating folders, renaming folders, fetching the root folder (`getRootFolder()`), and fetching immediate subfolders (`getSubFolders()`).
- `EntryService`: Exposes operations for `createEntry()`, `getEntryById()`, `getEntriesInFolder()`, `updateEntry()`, and `deleteEntry()`.
- `DescriptionService`: Exposes operations for `createDescription()`, `getDescriptionsForEntry()`, `updateDescription()`, and `deleteDescription()`.

## Client Hooks/Methods (`apps/tui/src/pages/dictionary`)

- The TUI client interacts with Domain Services via shared custom React hooks (e.g., `useServices`) to manage state:
  - `model/use-dictionary.ts`: Navigates the folder hierarchy using a `pathStack` and dynamically fetches the current folder's subfolders and entries.
  - **Action models** (`model/create.ts`, `model/delete.ts`, `model/rename.ts`): Call specific service methods in response to OpenTUI keyboard events.
