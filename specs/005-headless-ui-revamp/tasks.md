# Tasks: Headless UI Revamp

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and state shape first.)_

- [ ] T001: Update `packages/react/src/modules/dictionary/types.ts` to define `TreeItemRef`, `ActivePane`, and `InteractionAction`.
- [ ] T002: Refactor `useDictionaryStore.ts` to replace `focus` with `activePane` and `interactionAction`.
- [ ] T003: Rename selected index state to explicit cursors: `selectedTreeItemIndex` -> `treeCursor`, and `selectedDescriptionIndex` -> `descriptionCursor`.
- [ ] T004: Add `activeEntryId`, `selectedTreeItems`, `contextMenuTarget`, `selectedDescriptionIds`, and `descriptionContextMenuTargetId` to the store.

## Phase 2: Core Navigation Logic

_(Implement browse mode and entry mode before modifying destructive actions.)_

- [ ] T005: Update `useDictionary.ts` derived state so Descriptions load from `activeEntryId` when present and from `treeCursor` preview only in browse mode.
- [ ] T006: Update navigation actions to expose `moveCursor`, `openEntry`, and `closeEntry`.
- [ ] T007: Ensure `openEntry` always moves `treeCursor` to the opened Entry, sets `activeEntryId`, switches `activePane` to `description`, and clamps/resets `descriptionCursor`.
- [ ] T008: Ensure `closeEntry` clears `activeEntryId`, switches `activePane` to `tree`, and preserves `treeCursor` on the opened Entry.
- [ ] T009: Ensure keyboard movement cannot move `treeCursor` while `activeEntryId` exists.

## Phase 3: Selection & Context Targeting

_(Separate persistent selection from temporary context menu targeting.)_

- [ ] T010: [P] Add tree selection mutators: `setSelectedTreeItems`, `toggleSelectedTreeItem`, and `clearSelectedTreeItems`.
- [ ] T011: [P] Add context menu mutator: `setContextMenuTarget`.
- [ ] T012: [P] Add Description selection mutators: `setSelectedDescriptionIds`, `toggleSelectedDescriptionId`, and `clearSelectedDescriptionIds`.
- [ ] T013: [P] Add Description context menu mutator: `setDescriptionContextMenuTargetId`.
- [ ] T014: Implement target resolution helpers for tree actions and Description actions using the rules from `plan.md`.

## Phase 4: Action Updates

_(Update mutations to use explicit targets instead of implicit focus state.)_

- [ ] T015: Update `useTreeActions.ts` create and rename flows to use `activePane`, `interactionAction`, `treeCursor`, and single-target resolution.
- [ ] T016: Update `useTreeActions.ts` delete and move flows to use selection-aware tree target resolution.
- [ ] T017: Update `useDescriptionActions.ts` create flow to require `activeEntryId`.
- [ ] T018: Update `useDescriptionActions.ts` rename and delete flows to use Description target resolution.
- [ ] T019: Clear context menu targets after context actions complete or are cancelled.

## Phase 5: TUI Integration

_(Fix the existing Terminal UI to work with the new headless logic.)_

- [ ] T020: [P] Update TUI Tree view components to use `treeCursor` for visual highlighting.
- [ ] T021: [P] Update TUI Description view components to use `descriptionCursor` for visual highlighting.
- [ ] T022: Update TUI keybindings so `j/k` move the tree in browse mode and Descriptions in entry mode.
- [ ] T023: Update TUI keybindings so Enter/`l` opens Entries, while `h`, Escape, Backspace, or Left closes an active Entry before navigating up folders.
- [ ] T024: Add click handling where available so clicking an Entry opens it and updates `treeCursor`.

## Phase 6: Verification

- [ ] T025: Run `bun run typecheck`.
- [ ] T026: Manually verify TUI browse mode: `j/k` moves tree cursor and previews items while no Entry is active.
- [ ] T027: Manually verify TUI entry mode: Enter/`l` opens an Entry, `j/k` moves Description cursor, and `h`/Escape closes back to tree.
- [ ] T028: Manually verify target resolution rules for context menu and selection state with unit tests or focused integration tests if test harnesses exist.

## Phase 7: Absorb into Documentation

- [ ] Run `/docify.absorb` to update living documentation and archive this specification after implementation.
- [ ] **Manual Verification:** Ensure new UI vocabulary has been grilled and added to `CONTEXT.md`: `Tree Cursor`, `Description Cursor`, `Active Pane`, `Active Entry`, `Selected Tree Items`, and `Context Menu Target`.
