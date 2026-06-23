# Technical Plan: Headless UI Revamp

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

The `@dictos/react` package will transition from a coupled `focus + selected index` model to an explicit interaction state model. The current model treats keyboard focus, opened content, and action targets as the same thing. That works for a keyboard-only TUI, but it breaks down for mouse context menus and mobile tap navigation.

The new model separates the state into four responsibilities:

1. **Keyboard position**: `treeCursor` and `descriptionCursor` track where keyboard navigation is inside each pane.
2. **Opened content**: `activeEntryId` tracks the Entry explicitly opened by click, tap, Enter, or `l`.
3. **Persistent selection**: `selectedTreeItems` tracks Entries/Folders selected for batch actions.
4. **Temporary context targeting**: `contextMenuTarget` tracks the item that opened the current context menu.

The UI remains device-specific. TUI can use Vim keys, Web can use normal click/contextmenu behavior, and Mobile can use tap/back/long-press. The shared store owns the semantic state, not the visual transition.

## 2. Data Model & State Changes

### Shared Types

```typescript
type TreeItemReference =
  | { type: "entry"; id: string }
  | { type: "folder"; id: string };

type ActivePane = "tree" | "description";

type InteractionAction =
  | "idle"
  | "createInput"
  | "deleteConfirm"
  | "renameInput";
```

### `useDictionaryStore` (Zustand)

Replace the existing `focus` object and selected index names with explicit properties.

```typescript
interface DictionaryStore {
  activePane: ActivePane;
  interactionAction: InteractionAction;

  treeCursor: number;
  descriptionCursor: number;

  activeEntryId: string | null;

  selectedTreeItems: TreeItemReference[];
  contextMenuTarget: TreeItemReference | null;

  selectedDescriptionIds: string[];
  descriptionContextMenuTargetId: string | null;
}
```

`selectedTreeItems` stores refs instead of full Entry/Folder objects to avoid stale object state after rename, move, delete, or sync. Raw IDs alone are not enough because Entries and Folders can share the same ID shape, so the type is part of the identity.

Descriptions use separate selection/context state because Description actions live in the Description pane and should not be mixed with Entry/Folder batch actions.

## 3. Modes & Navigation Rules

### Browse Mode

Browse mode is active when `activeEntryId === null`.

- `activePane` is `tree`.
- `j/k` and Arrow Up/Down move `treeCursor`.
- Moving `treeCursor` updates the preview pane.
- Enter, `l`, click, or tap opens an Entry.
- Navigating into a Folder changes the path stack and resets `treeCursor` to `0`.

### Entry Mode

Entry mode is active when `activeEntryId !== null`.

- `activePane` is `description`.
- `j/k` and Arrow Up/Down move `descriptionCursor`.
- Keyboard input does not move `treeCursor` while an Entry is active.
- `h`, Escape, Backspace, or platform Back clears `activeEntryId` and returns `activePane` to `tree`.
- Closing the Entry preserves `treeCursor` on the opened Entry.

Opening an Entry from any modality must always move `treeCursor` to that Entry before setting `activeEntryId`.

## 4. Interface Contracts & Boundaries

### `useNavigationActions`

```typescript
interface NavigationActions {
  setActivePane(pane: ActivePane): void;
  setInteractionAction(action: InteractionAction): void;

  moveCursor(direction: "up" | "down"): void;

  openEntry(entryId: string): void;
  closeEntry(): void;

  navigateIn(): void;
  navigateOut(): void;
}
```

`openEntry` is used by keyboard, mouse, and touch handlers. It finds the Entry in `treeItemsToDisplay`, moves `treeCursor` to that Entry when present, sets `activeEntryId`, resets or clamps `descriptionCursor`, and switches `activePane` to `description`.

### Selection Actions

```typescript
interface SelectionActions {
  setSelectedTreeItems(items: TreeItemReference[]): void;
  toggleSelectedTreeItem(item: TreeItemReference): void;
  clearSelectedTreeItems(): void;

  setContextMenuTarget(item: TreeItemReference | null): void;

  setSelectedDescriptionIds(ids: string[]): void;
  toggleSelectedDescriptionId(id: string): void;
  clearSelectedDescriptionIds(): void;

  setDescriptionContextMenuTargetId(id: string | null): void;
}
```

The visual mechanics for range selection, Vim visual mode, and mobile edit mode can be added later. This phase only needs the state and mutators.

## 5. Action Target Resolution

Do not use one universal fallback rule. Different actions have different native expectations.

### Open Entry

Target source:

1. Explicit clicked/tapped Entry ID.
2. Entry at `treeCursor`.

### Rename Tree Item

Target source:

1. `contextMenuTarget`.
2. Item at `treeCursor`.

For now rename ignores multi-selection. Later we will implement batch renames.

### Delete / Move Tree Items

Target source:

1. If `contextMenuTarget` is inside `selectedTreeItems`, target all `selectedTreeItems`.
2. Else if `contextMenuTarget` exists, target only `contextMenuTarget`.
3. Else if `selectedTreeItems` is non-empty, target all `selectedTreeItems`.
4. Else target the item at `treeCursor`.

Right-click and long-press must not mutate `treeCursor`, `activeEntryId`, or `selectedTreeItems` by themselves.

### Create Description

Target source:

1. `activeEntryId`.

Descriptions can only be created while an Entry is active.

### Rename Description

Target source:

1. `descriptionContextMenuTargetId`.
2. Description at `descriptionCursor`.

Rename ignores multi-selection for now.

### Delete Descriptions

Target source:

1. If `descriptionContextMenuTargetId` is inside `selectedDescriptionIds`, target all `selectedDescriptionIds`.
2. Else if `descriptionContextMenuTargetId` exists, target only that Description.
3. Else if `selectedDescriptionIds` is non-empty, target all `selectedDescriptionIds`.
4. Else target the Description at `descriptionCursor`.

## 6. TUI Integration Notes

- `j/k` keep Vim-style navigation.
- Enter/`l` opens the Entry under `treeCursor`.
- `h`, Escape, Backspace, or Left closes the active Entry before navigating up folders.
- Tree highlighting uses `treeCursor`.
- Description highlighting uses `descriptionCursor`.
- TUI can keep panes visible side-by-side, but keyboard mode must still follow browse mode vs entry mode.

## 7. Future Client Notes

- Web should use click-to-open and native `contextmenu` events.
- Mobile should use tap-to-open, platform Back to close, and long-press/action sheet for context actions.
- The store must not contain screen-size checks or animation state.
