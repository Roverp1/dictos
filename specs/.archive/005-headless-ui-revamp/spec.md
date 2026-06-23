# Specification: Headless UI Revamp

**Status**: Draft | **Created**: 2026-06-19

## 1. The Problem (Why are we doing this?)

Currently, the headless React logic (`@dictos/react`) lacks a unified state model to handle different input modalities (keyboard, mouse, touch) elegantly. Navigation on desktop works via a "preview" pane linked to keyboard focus, but on mobile, we need a way to tap an Entry to open its Description pane without breaking keyboard navigation workflows or relying on fragile UI-layer hacks to remember previously opened items.

Furthermore, we lack a clean mechanism for batch operations and right-click context menu actions. Right now, actions implicitly target the visually focused item, meaning right-clicking an unselected item to delete it would hijack the user's primary focus. We need a model where keyboard focus, opened Entry, persistent selection, and temporary context menu targeting are distinct.

## 2. The Solution (What are we building?)

We will revamp the `@dictos/react` headless state around two primary modes and explicit action targeting.

1. **Browse Mode**: No Entry is active. Keyboard focus is in the tree, `j/k` move the `treeCursor`, and the Description pane previews the Entry or Folder under the cursor.
2. **Entry Mode**: An Entry is active. Keyboard focus is in the Description pane, `j/k` move the `descriptionCursor`, and the tree cursor does not move from keyboard input.

This introduces explicit concepts to decouple state that currently gets mixed together:

1. **Tree Cursor**: The keyboard position in the Folder/Entry tree.
2. **Description Cursor**: The keyboard position in the visible Description list.
3. **Active Entry**: The Entry explicitly opened by click, tap, Enter, or `l`.
4. **Selected Tree Items**: Persistent batch selection for Entries and Folders.
5. **Context Menu Target**: A temporary target created by right-click or long-press context menus.

We will also update action signatures so operations resolve their targets from the correct source instead of assuming the current cursor is always the target.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Desktop Keyboard Preview**
  Given the user is browsing the Dictionary with no active Entry, When they press `j` or `k`, Then the `treeCursor` moves, and the Description pane dynamically previews the newly highlighted item.

- **Scenario: Opening an Entry**
  Given the user is previewing an Entry, When they press Enter/`l`, click it, or tap it, Then the store moves `treeCursor` to that Entry, sets `activeEntryId`, switches `activePane` to `description`, and subsequent `j`/`k` presses move the `descriptionCursor`.

- **Scenario: Closing an Entry**
  Given the user has an active Entry, When they press `h`, Escape, or the platform Back action, Then `activeEntryId` is cleared, `activePane` returns to `tree`, and the `treeCursor` remains on the Entry that was just closed.

- **Scenario: Mobile Touch Workflow**
  Given the user is on mobile with the Description pane hidden, When they tap an Entry, Then it becomes the active Entry and the UI opens the Description screen/sheet. If they go back, the UI returns to the tree with the cursor on the Entry they opened.

- **Scenario: Context Menu Independence**
  Given the user has Entry A open as the active Entry, When they right-click Entry B, Then Entry B becomes the `contextMenuTarget`. When they click "Delete" in the context menu, Entry B is deleted, and Entry A remains open and unaffected.

- **Scenario: Context Menu With Existing Selection**
  Given Entry B and Entry C are in `selectedTreeItems`, When the user right-clicks Entry B, Then context menu actions apply to Entry B and Entry C. When the user right-clicks unselected Entry D instead, Then context menu actions apply only to Entry D and `selectedTreeItems` remains unchanged.

- **Scenario: Description Context Menu**
  Given the user has an active Entry with visible Descriptions, When they right-click a Description, Then the context menu action targets that Description without changing `descriptionCursor` unless the UI explicitly opens the Description first.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] We are NOT implementing full visual UI components for every client in this specification; this is primarily for the `@dictos/react` headless state and the current TUI integration needed to keep the app working.
- [ ] We are NOT building the final visual multi-select mechanics (e.g., shift+click ranges, Vim visual mode, or mobile edit mode) in this phase. We are only building the underlying selected item state and target resolution needed to support those mechanics later.
- [ ] We are NOT solving automatic refresh from sync events in this phase.
- [ ] We are NOT allowing one batch selection to mix tree items and Descriptions. Entries/Folders and Descriptions are selected separately because they live in different panes and support different actions.

## 5. Success Criteria (How do we know we are done?)

- [ ] The store manages browse mode and entry mode through `activeEntryId`, `activePane`, `treeCursor`, and `descriptionCursor`.
- [ ] Opening an Entry by keyboard, mouse, or touch always updates `treeCursor`, sets `activeEntryId`, and moves focus to the Description pane.
- [ ] While `activeEntryId` exists, keyboard navigation operates on the Description pane and does not move `treeCursor`.
- [ ] Closing an Entry clears `activeEntryId`, returns focus to the tree, and preserves the tree cursor on the opened Entry.
- [ ] Tree batch actions distinguish persistent `selectedTreeItems` from temporary `contextMenuTarget`.
- [ ] Context menu actions use a temporary context target without mutating active Entry, cursor, or persistent selected items by themselves.
- [ ] Rename actions remain single-target actions and do not apply to multi-selection.

## 6. Assumptions

- [ ] Assuming the UI layer (OpenTUI, Web, React Native) is responsible for routing right-clicks and long-presses to set `contextMenuTarget` before firing a context menu action.
- [ ] Assuming the UI layer uses the presence of a non-null `activeEntryId` to trigger detail pane visibility, screen transitions, sliding animations, or native navigation on constrained screens.
- [ ] Assuming Vim-style keyboard shortcuts are acceptable for TUI power-user navigation, while click/tap behavior follows a mail-app style single-click/tap-to-open model.
