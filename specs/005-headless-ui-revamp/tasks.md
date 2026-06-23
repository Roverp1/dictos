# Tasks: Headless UI Revamp

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and state shape first.)_

- [x] T001: Update `packages/react/src/modules/dictionary/types.ts` to define `TreeItemReference`, `ActivePane`, and `InteractionAction`.
- [x] T002: Refactor `useDictionaryStore.ts` to replace `focus` with `activePane` and `interactionAction`.
- [x] T003: Rename selected index state to explicit cursors: `selectedTreeItemIndex` -> `treeCursor`, and `selectedDescriptionIndex` -> `descriptionCursor`.
- [x] T004: Add `activeEntryId`, `selectedTreeItems`, `contextMenuTarget`, `selectedDescriptionIds`, and `descriptionContextMenuTargetId` to the store.
- [x] T004A: Replace `treeItemsToDisplay`, `treeItemsOnHoverToDisplay`, and `descriptionsToDisplay` with `currentFolderItems`, `previewPaneContent`, and `activeEntryDescriptions`.
- [x] T004B: Document the lifecycle rules for tree and Description context menu targets in the store API.

## Phase 2: Core Navigation Logic

_(Implement browse mode and entry mode before modifying destructive actions.)_

- [x] T005: Update `useDictionary.ts` derived state so Descriptions load from `activeEntryId` when present and from `treeCursor` preview only in browse mode.
- [x] T006: Update navigation actions to expose `moveCursor`, `openEntry`, and `closeEntry`.
- [x] T007: Ensure `openEntry` always moves `treeCursor` to the opened Entry, sets `activeEntryId`, switches `activePane` to `description`, and clamps/resets `descriptionCursor`.
- [x] T008: Ensure `closeEntry` clears `activeEntryId`, switches `activePane` to `tree`, and preserves `treeCursor` on the opened Entry.
- [x] T009: Ensure keyboard movement cannot move `treeCursor` while `activeEntryId` exists.
- [x] T009A: Split cursor-driven preview loading from active Entry Description loading.
- [x] T009B: Add stale active Entry Description guard so late loads cannot overwrite a newer active Entry.

## Phase 3: Selection & Context Targeting

_(Separate persistent selection from temporary context menu targeting.)_

- [x] T010: [P] Add tree selection API actions: `selectTreeItem`, `unselectTreeItem`, `toggleTreeItemSelection`, and `clearTreeSelection`.
- [x] T011: [P] Add tree context menu API actions: `openTreeContextMenu` and `closeTreeContextMenu`.
- [x] T012: [P] Add Description selection API actions: `selectDescription`, `unselectDescription`, `toggleDescriptionSelection`, and `clearDescriptionSelection`.
- [x] T013: [P] Add Description context menu API actions: `openDescriptionContextMenu` and `closeDescriptionContextMenu`.
- [x] T014: Add single-target resolution for tree and Description actions using cursor fallback and context menu target override.
- [ ] T014A: Add batch target resolution for tree delete/move using `selectedTreeItems` and `contextMenuTarget` rules from `plan.md`.
- [ ] T014B: Add batch target resolution for Description delete using `selectedDescriptionIds` and `descriptionContextMenuTargetId` rules from `plan.md`.

## Phase 4: Action Updates

_(Update mutations to use explicit targets instead of implicit focus state.)_

- [x] T015: Update `useTreeActions.ts` create and rename flows to use `activePane`, `interactionAction`, `treeCursor`, and single-target resolution.
- [ ] T016: Update `useTreeActions.ts` delete and move flows to use selection-aware tree target resolution.
- [x] T017: Update `useDescriptionActions.ts` create flow to require `activeEntryId`.
- [x] T018: Update `useDescriptionActions.ts` rename and delete flows to use Description target resolution.
- [x] T019: Clear context menu targets after context actions complete or are cancelled.
- [x] T019A: Expose `actions.selection` from `useDictionary()` as the stable cross-platform selection/context API.
- [ ] T019B: Decide whether failed delete actions should clear context targets and exit confirmation consistently.

## Phase 5: TUI Integration

_(Fix the existing Terminal UI to work with the new headless logic.)_

- [x] T020: [P] Update TUI Tree view components to use `treeCursor` for visual highlighting.
- [x] T021: [P] Update TUI Description view components to use `descriptionCursor` for visual highlighting.
- [x] T022: Update TUI keybindings so `j/k` move the tree in browse mode and Descriptions in entry mode.
- [x] T023: Update TUI keybindings so Enter/`l` opens Entries, while `h`, Escape, Backspace, or Left closes an active Entry before navigating up folders.
- [ ] T024: Add click handling where available so clicking an Entry opens it and updates `treeCursor`.

## Phase 5A: Web Integration

- [x] T024A: Update Web Dictionary page keybindings and modals to use `activePane`, `interactionAction`, `moveCursor`, `treeCursorItem`, and `descriptionCursorItem`.
- [x] T024B: Update Web Tree view to use `currentFolderItems`, `treeCursor`, and the new action state.
- [x] T024C: Update Web Description pane to render read-only `previewPaneContent` in browse mode and `activeEntryDescriptions` in entry mode.

## Phase 6: Verification

- [ ] T025: Run `bun run typecheck`.
- [ ] T026: Manually verify TUI browse mode: `j/k` moves tree cursor and previews items while no Entry is active.
- [ ] T027: Manually verify TUI entry mode: Enter/`l` opens an Entry, `j/k` moves Description cursor, and `h`/Escape closes back to tree.
- [ ] T028: Manually verify target resolution rules for context menu and selection state with unit tests or focused integration tests if test harnesses exist.

## Phase 7: Absorb into Documentation

- [ ] Run `/docify.absorb` to update living documentation and archive this specification after implementation.
- [ ] **Manual Verification:** Ensure new UI vocabulary has been grilled and added to `CONTEXT.md`: `Tree Cursor`, `Description Cursor`, `Active Pane`, `Active Entry`, `Selected Tree Items`, and `Context Menu Target`.
