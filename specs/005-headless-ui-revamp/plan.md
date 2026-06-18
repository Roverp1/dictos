# Technical Plan: Headless UI Revamp

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

The `@dictos/react` package will transition to a State architecture to manage UI focus and interactions uniformly across desktop and mobile. Previously, visual state (which pane is open) was tightly coupled to input state (where the keyboard is pointing), causing conflicts when adapting to touch interfaces.

We are adopting a model inspired by the Yazi file manager. We decouple the state into three distinct layers:

1. **Cursors (`treeCursor`, `descriptionCursor`)**: Persistent indices tracking keyboard position within specific lists. They never lose their place when the user switches panes.
2. **Visual Lock (`activeItem`)**: An explicit ID that dictates whether the Description pane is locked open (crucial for mobile sliding views).
3. **Action Targets (`selectionPool`)**: A collection of IDs used for batch operations.

By separating these, a mobile user can tap an entry to set the `activeItem` (sliding up the pane), while desktop users can navigate the `treeCursor` to see live previews. Furthermore, right-click actions simply update the `selectionPool` before firing, ensuring the target of the action is decoupled from the user's primary keyboard cursor.

## 2. Data Model & State Changes

### `useDictionaryStore` (Zustand)

We will replace the existing `focus` object and global indices with explicit, decoupled properties.

- **`activePane`** (`'tree' | 'description'`): Dictates which cursor receives keyboard navigation events.
- **`treeCursor`** (`number`): The index of the currently highlighted item in `treeItemsToDisplay`. Default: `0`.
- **`descriptionCursor`** (`number`): The index of the currently highlighted description in `descriptionsToDisplay`. Default: `0`.
- **`activeItem`** (`string | null`): The ID of the Entry explicitly locked open. When not null, it overrides dynamic tree previews.
- **`selectionPool`** (`Set<string>`): A collection of item IDs currently selected for batch operations.

## 3. Interface Contracts & Boundaries

The headless action hooks will be updated to manage this new state and resolve targets using the fallback pattern.

### Target Resolution Logic (Internal)

When a modification action (Delete, Rename, Move) fires, the store resolves the target as follows:

1. If `selectionPool` is not empty, operate on those IDs.
2. If `selectionPool` is empty, operate on the item pointed to by the cursor of the `activePane`.

### `useNavigationActions` (State Mutators)

```typescript
interface NavigationActions {
  /** Switches keyboard input focus between panes */
  setActivePane(pane: "tree" | "description"): void;

  /** Moves the cursor of the active pane up or down */
  moveCursor(direction: "up" | "down"): void;

  /**
   * Locks the description view to a specific entry.
   * Also automatically shifts `activePane` to 'description'.
   */
  setActiveItem(id: string | null): void;

  /** Overwrites the selection pool (used for right-click context menus) */
  setSelection(ids: string[]): void;

  /** Toggles an item in the pool (used for visual multi-select) */
  toggleSelection(id: string): void;

  /** Clears the selection pool */
  clearSelection(): void;
}
```

### `useTreeActions` & `useDescriptionActions`

Modification actions will no longer rely on implicit single-item state. They will internally resolve their targets using the `selectionPool` fallback logic described above.

```typescript
interface TreeActions {
  /**
   * Requests deletion.
   * Target: selectionPool OR item at treeCursor.
   */
  requestDelete(): void;

  /**
   * Requests rename.
   * Target: item at treeCursor (Rename is inherently a single-item action, it ignores selectionPool).
   */
  requestRename(): void;
}
```

