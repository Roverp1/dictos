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

## Headless Dictionary UI (`packages/react/src/modules/dictionary`)

`@dictos/react` exposes shared Dictionary state and actions for clients. It receives the domain services through `DictosProvider` and keeps TUI, Web, and future Mobile clients from duplicating Dictionary interaction logic.

The headless Dictionary model separates these UI concerns:

- **Browse mode**: no Entry is active, tree cursor navigation drives preview content.
- **Entry mode**: an Entry is active, Description cursor navigation drives the active Description list.
- **Persistent selection**: Entries/Folders and Descriptions can be marked for future batch actions without changing cursor or active Entry state.
- **Context menu targets**: right-click or long-press actions target temporary items without implying selection or cursor movement.

Key public state includes `currentFolderItems`, `previewPaneContent`, `activeEntryId`, `activeEntryDescriptions`, `activePane`, `interactionAction`, `treeCursor`, `descriptionCursor`, `selectedTreeItems`, `selectedDescriptionIds`, and context menu target state.

Key action groups include navigation actions, tree actions, Description actions, selection/context actions, and general cancellation/input actions.

Client applications remain responsible for presentation and input bindings. Each client should lean on its most natural input first, but the headless model is meant to work with keyboard, mouse, touch, context menus, and long-press flows wherever the platform supports them.
