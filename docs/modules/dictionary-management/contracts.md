# Contracts & Interfaces: Dictionary Management

**Parent Module**: [domain.md](./domain.md)

## Hexagonal Ports (`packages/core/src/ports/outbound`)

The domain relies on these interfaces to persist data through the Turso/Drizzle adapters:

- `FolderRepository`: Defines methods like `save()`, `findRoot()`, `findAll()`, `findByParentId()`, `update()`, and `delete()`.
- `EntryRepository`: Defines methods like `save()`, `findById()`, `findByFolder()`, `update()`, and `delete()`.
- `DescriptionRepository`: Defines `save()`, `findById()`, `findByEntry()`, `findBySense()`, typed `update()`, `assignSense()`, and `delete()`.
- `SenseRepository`: Defines `save()`, `findById()`, `findByEntry()`, `update()`, and `delete({ id, cascade })`.
- `DescriptionGenerationRepository`: Owns atomic persistence for an accepted Description Generation proposal. Its single `commitProposal()` operation creates or reuses a Sense, assigns an unassigned source Description when required, and saves generated Descriptions together.
- `ScreenEntrySaveRepository`: Owns atomic persistence of reviewed screen text through `commit()`: insert or reuse the root Entry, create the optional new Sense, save the chosen Descriptions, and increment Activity once.

## Core Services (`packages/core/src/services`)

These services expose the pure domain logic use-cases to the clients (e.g., the TUI):

- `FolderService`: Handles validation and execution for creating folders, renaming folders, fetching the root folder (`getRootFolder()`), fetching a folder by ID (`getFolderById()`), and fetching immediate subfolders (`getSubFolders()`).
- `EntryService`: Exposes operations for `createEntry()`, `getEntryById()`, `getEntriesInFolder()`, `updateEntry()`, and `deleteEntry()`.
- `DescriptionService`: Exposes `createDescription()`, `getDescriptionById()`, `getDescriptionsForEntry()`, `updateDescription()`, `assignToSense()`, `detachFromSense()`, and `deleteDescription()`. It enforces same-Entry assignment and prevents moving an assigned Description to another Entry.
- `SenseService`: Exposes `createSense()`, `getSenseById()`, `getSensesForEntry()`, `renameSense()`, and `deleteSense()`. Deletion detaches Descriptions by default; callers must explicitly request cascading deletion.
- `ScreenEntrySaveService`: Exposes `save()`, validates reviewed text and Description Types, and filters blank optional text before calling `ScreenEntrySaveRepository.commit()`.

## Reviewed screen Save contract

The core contract in `packages/core/src/models/screen-entry-save.ts` distinguishes center Save from the two right Save variants:

```typescript
export type ScreenEntrySaveInput =
  | {
      kind: "entry";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
    }
  | {
      kind: "sense";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
      includeDescription: boolean;
      senseName: string;
      descriptions: { type: DescriptionType; text: string }[];
    };

export interface ScreenEntrySaveResult {
  entry: Entry;
  sense: Sense | null;
  capturedDescription: Description | null;
  descriptions: Description[];
}

export interface ScreenEntrySaveRepository {
  commit(input: ScreenEntrySaveInput): Promise<ScreenEntrySaveResult | DbError>;
}
```

`ScreenEntrySaveService.save(input)` returns `Promise<ScreenEntrySaveResult | ValidationError | DbError>`. Entry text and the root Folder ID must be nonblank. For `kind: "sense"`, the Sense name must be nonblank, every supplied Type must be one of `misc`, `translation`, `definition`, or `example`, and at least one typed Description must contain nonblank text. Types are validated before blank slots are filtered. Captured text does not count toward the typed Description requirement.

The service preserves nonblank reviewed text exactly. Blank captured text becomes `null`; blank typed slots are removed. Center Save allows an Entry alone or an optional unassigned captured `misc`. Ordinary right Save (`includeDescription: false`) ignores captured context. Inclusive right Save (`includeDescription: true`) saves nonblank captured text as `misc` under the same new Sense as the typed Descriptions. `capturedDescription` is returned separately from the typed `descriptions` array.

`SqliteScreenEntrySaveRepository` verifies that the target Folder has `parentId: null` and name `/` before writing. It uses the shared `entry-write.ts` helpers to insert or reuse the Entry by exact text and Folder identity, then verifies the returned row still has that text and Folder. A renamed Entry under the old deterministic identity returns `DbError` and rolls back the save. Either right Save creates a new Sense; duplicate names never cause silent Sense reuse.

The adapter performs all record writes and one Activity increment within one transaction, including on Entry reuse. `withEntryWriteTransaction()` rejects the transaction callback on an Error value so post-write invariant failures trigger rollback; SQL failures also roll back. The adapter converts transaction failures to `DbError` values at its boundary. It must never return a successful result with partial writes or commit earlier rows by merely returning an Error from the transaction callback.

Saved-Description generation retains `DescriptionGenerationRepository.commitProposal()`. It targets the source Description's existing Sense by identity, or creates a Sense and assigns an unassigned source Description atomically with generated Descriptions. Reviewed screen Save uses current editor text and has no persisted proposal ID or saved source Description requirement.

## Headless Dictionary UI (`packages/react/src/modules/dictionary`)

`@dictos/react` exposes shared Dictionary state and actions for clients. It receives the domain services, `Logger`, and platform-provided `Notifier` through `DictosProvider`, keeping platform-specific Notification renderers out of the shared package. The retained Web client was built around this interface but is currently broken and unmaintained.

The headless Dictionary model separates these UI concerns:

- **Browse mode**: no Entry is active, tree cursor navigation drives preview content.
- **Entry mode**: an Entry is active, Description cursor navigation drives the active Description list.
- **Persistent selection**: Entries/Folders and Descriptions can be marked for future batch actions without changing cursor or active Entry state.
- **Context menu targets**: right-click or long-press actions target temporary items without implying selection or cursor movement.

Key public state includes `currentFolderItems`, `previewPaneContent`, `activeEntryId`, `activeEntryDescriptions`, `activePane`, `interactionAction`, `treeCursor`, `descriptionCursor`, `selectedTreeItems`, `selectedDescriptionIds`, and context menu target state.

Key action groups include navigation actions, tree actions, Description actions, selection/context actions, and general cancellation/input actions. User-actionable service failures in these actions should be logged and surfaced through the injected `Notifier`; developer-only impossible states should remain logged unless the user can act on the message.

Client applications remain responsible for presentation and input bindings. Each client should lean on its most natural input first, but the headless model is meant to work with keyboard, mouse, touch, context menus, and long-press flows wherever the platform supports them.

## Command Client Dictionary Interface (`apps/cli`)

The CLI exposes Folder, Entry, Description, and Sense management through Commander.js subcommands. It uses the same Dictionary services as the TUI and operates on the shared local database. The retained Web client was also built around those services but is broken and unmaintained. `entry create` and `entry list` use the root Folder when `--folder` is omitted; an explicit Folder ID selects another Folder. Description Generation is composed separately for the CLI and is not part of shared React state.

`dictos overlay save --json` reads one structured stdin request with the fields of `ScreenEntrySaveInput` except `folderId`. The handler in `apps/cli/src/commands/overlay.ts` resolves the root Folder through `FolderService.getRootFolder()` and supplies its ID to `ScreenEntrySaveService.save()`. This path uses Dictionary dependencies without resolving a Model or Provider.

On success, the JSON result contains `entryId`, nullable `senseId`, nullable `capturedDescriptionId`, and `descriptionIds` for the saved typed Descriptions. These IDs describe committed records. Save is one persistence operation, not a chain of independent create commands; it requires no Dictionary schema change or migration.

The overlay checks the process outcome and receipt shape, including record presence, unique typed IDs, a separate captured ID, and the expected typed Description count. It retains drafts until success is confirmed and does not automatically retry an unknown outcome. Pending saves block duplicate submission; confirmed Save then flushes overlay-local preferences before exit. See [Description Generation contracts](../description-generation/contracts.md#provisional-overlay-commands) for JSON framing and error codes.

## Notification Boundary (`packages/react/src/providers`)

The `Notifier` interface describes user-visible Notification intent for `@dictos/react` without depending on a renderer. It supports common toast-like operations such as `message`, `success`, `info`, `warning`, `error`, `loading`, `dismiss`, and `promise`.

Promise-backed Notifications follow the project errors-as-values rule: expected failures resolve as `Error` values, and `notifier.promise()` renders those as error Notifications while returning the same error. Rejected promises are boundary failures and should be converted before they reach the Notifier.
