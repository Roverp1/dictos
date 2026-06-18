# Specification: Headless UI Revamp

**Status**: Draft | **Created**: 2026-06-19

## 1. The Problem (Why are we doing this?)

Currently, the headless React logic (`@dictos/react`) lacks a unified state model to handle different input modalities (keyboard, mouse, touch) elegantly. Navigation on desktop works via a "preview" pane linked to keyboard focus, but on mobile, we need a way to tap an entry to "lock" a description pane open without breaking keyboard navigation workflows or relying on fragile UI-layer hacks to remember previously selected items.

Furthermore, we lack a clean mechanism for batch operations or right-click context menu actions. Right now, actions implicitly target the visually focused item, meaning right-clicking an unselected item to delete it would hijack the user's primary focus. Finally, after a data sync, the UI does not currently update automatically, forcing the user to manually refresh by navigating folders.

## 2. The Solution (What are we building?)

We will revamp the `@dictos/react` headless state to use a State architecture. This introduces three explicit concepts to decouple visual state from interaction state:

1. **Tree Cursor**: For relative keyboard navigation and dynamic previews.
2. **Active Item**: To explicitly lock an entry's description view open, overriding previews and driving mobile visibility.
3. **Selection Pool**: A decoupled set of IDs for batch operations, inspired by the Yazi file manager.

We will also update the action signatures to gracefully handle this new state and ensure the store automatically responds to sync events to trigger UI refreshes.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Desktop Keyboard Preview**
  Given the user is browsing the dictionary with no active item, When they press `j` or `k`, Then the `treeCursor` moves, and the Description pane dynamically updates to preview the newly highlighted item.

- **Scenario: Locking a Description**
  Given the user is previewing an Entry, When they press `l` (or click it), Then the Entry becomes the `activeItem`, the Description pane locks onto this Entry, and subsequent `j`/`k` presses move the `descriptionCursor` in an active description pane.

- **Scenario: Mobile Touch Workflow**
  Given the user is on mobile with the description pane hidden, When they tap an Entry, Then it becomes the `activeItem` and the UI slides the description pane up. If they scroll the background tree and tap another entry, the `activeItem` updates and the pane content changes without closing.

- **Scenario: Context Menu Independence**
  Given the user has Entry A locked open as the `activeItem`, When they right-click Entry B, Then Entry B is placed into the `selectionPool`. When they click "Delete" on the context menu, Entry B is deleted, and Entry A remains open and completely unaffected.

- **Scenario: Automatic Sync Refresh**
  Given the user is looking at a folder, When a background sync pulls new entries into that folder, Then the headless store automatically triggers a refresh, and the UI updates to show the new entries without manual intervention.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] We are NOT implementing the UI components themselves (TUI, React Native) in this specification; this is strictly for the `@dictos/react` headless state and action signatures.
- [ ] We are NOT building the visual multi-select selection mechanics (e.g., shift+click or pressing 'v' for visual range selection) in this phase. We are only building the underlying `selectionPool` state that will eventually support those mechanics.

## 5. Success Criteria (How do we know we are done?)

- [ ] The store manages `treeCursor`, `descriptionCursor`, `activeItem`, and a `selectionPool` (array of IDs).
- [ ] All modification actions (Delete, Rename, Move) prioritize operating on the `selectionPool`. If the pool is empty, they fall back to operating on the appropriate cursor.
- [ ] The mobile "locking" behavior is fully supported via the `activeItem` state without conditional device-specific logic inside the store itself.
- [ ] The UI automatically refreshes when underlying data is updated via sync.

## 6. Assumptions

- [ ] Assuming the UI layer (OpenTUI, React Native) is responsible for routing right-clicks to correctly update the `selectionPool` before firing an action.
- [ ] Assuming the UI layer uses the presence of a non-null `activeItem` to trigger sliding animations or pane visibility on constrained screens.
