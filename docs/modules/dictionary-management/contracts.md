# Contracts & Interfaces: Dictionary Management

**Parent Module**: [domain.md](./domain.md)

## Hexagonal Ports (`packages/core/src/ports/outbound`)

The domain relies on these interfaces to persist data, abstracting away the concrete libSQL/Drizzle implementation:

- `FolderRepository`: Defines methods like `save()`, `findRoot()`, `findAll()`, `findByParentId()`, `update()`, and `delete()`.
- `EntryRepository`: Defines methods like `save()`, `findById()`, `findByFolder()`, `update()`, and `delete()`.
- `DescriptionRepository`: Defines `save()`, `findById()`, `findByEntry()`, `findBySense()`, typed `update()`, `assignSense()`, and `delete()`.
- `SenseRepository`: Defines `save()`, `findById()`, `findByEntry()`, `update()`, and `delete({ id, cascade })`.
- `DescriptionGenerationRepository`: Owns atomic persistence for an accepted Description Generation proposal. Its single `commitProposal()` operation creates or reuses a Sense, assigns an unassigned source Description when required, and saves generated Descriptions together.

## Core Services (`packages/core/src/services`)

These services expose the pure domain logic use-cases to the clients (e.g., the TUI):

- `FolderService`: Handles validation and execution for creating folders, renaming folders, fetching the root folder (`getRootFolder()`), fetching a folder by ID (`getFolderById()`), and fetching immediate subfolders (`getSubFolders()`).
- `EntryService`: Exposes operations for `createEntry()`, `getEntryById()`, `getEntriesInFolder()`, `updateEntry()`, and `deleteEntry()`.
- `DescriptionService`: Exposes `createDescription()`, `getDescriptionById()`, `getDescriptionsForEntry()`, `updateDescription()`, `assignToSense()`, `detachFromSense()`, and `deleteDescription()`. It enforces same-Entry assignment and prevents moving an assigned Description to another Entry.
- `SenseService`: Exposes `createSense()`, `getSenseById()`, `getSensesForEntry()`, `renameSense()`, and `deleteSense()`. Deletion detaches Descriptions by default; callers must explicitly request cascading deletion.

## Headless Dictionary UI (`packages/react/src/modules/dictionary`)

`@dictos/react` exposes shared Dictionary state and actions for clients. It receives the domain services, `Logger`, and platform-provided `Notifier` through `DictosProvider`, keeping TUI, Web, and future Mobile clients from duplicating Dictionary interaction logic or leaking platform-specific Notification renderers into the shared package.

The headless Dictionary model separates these UI concerns:

- **Browse mode**: no Entry is active, tree cursor navigation drives preview content.
- **Entry mode**: an Entry is active, Description cursor navigation drives the active Description list.
- **Persistent selection**: Entries/Folders and Descriptions can be marked for future batch actions without changing cursor or active Entry state.
- **Context menu targets**: right-click or long-press actions target temporary items without implying selection or cursor movement.

Key public state includes `currentFolderItems`, `previewPaneContent`, `activeEntryId`, `activeEntryDescriptions`, `activePane`, `interactionAction`, `treeCursor`, `descriptionCursor`, `selectedTreeItems`, `selectedDescriptionIds`, and context menu target state.

Key action groups include navigation actions, tree actions, Description actions, selection/context actions, and general cancellation/input actions. User-actionable service failures in these actions should be logged and surfaced through the injected `Notifier`; developer-only impossible states should remain logged unless the user can act on the message.

Client applications remain responsible for presentation and input bindings. Each client should lean on its most natural input first, but the headless model is meant to work with keyboard, mouse, touch, context menus, and long-press flows wherever the platform supports them.

## Command Client Dictionary Interface (`apps/cli`)

The CLI exposes Folder, Entry, Description, and Sense management through Commander.js subcommands. It composes the same Dictionary services used by the TUI and Web client, operating on the shared local database. `entry create` and `entry list` use the root Folder when `--folder` is omitted; an explicit Folder ID selects another Folder. Description Generation is composed separately for the CLI and is not part of shared React state.

## Notification Boundary (`packages/react/src/providers`)

The `Notifier` interface describes user-visible Notification intent for `@dictos/react` without depending on a renderer. It supports common toast-like operations such as `message`, `success`, `info`, `warning`, `error`, `loading`, `dismiss`, and `promise`.

Promise-backed Notifications follow the project errors-as-values rule: expected failures resolve as `Error` values, and `notifier.promise()` renders those as error Notifications while returning the same error. Rejected promises are boundary failures and should be converted before they reach the Notifier.
