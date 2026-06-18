# Tasks: Headless UI Revamp

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and state shape first)._

- [ ] T001: Update types in `packages/react/src/modules/dictionary/types.ts` to remove the old `FocusState` and define the new primitive types (`activePane`, `treeCursor`, `descriptionCursor`, `activeItem`, `selectionPool`).
- [ ] T002: Refactor `useDictionaryStore.ts` to implement the new state shape, replacing the old `focus` object with the new decoupled properties and their setter functions.

## Phase 2: Core Logic & Interfaces

_(Updating the headless action hooks to use the new state and fallback logic)._

- [ ] T003: [P] Update `useNavigationActions.ts` to expose the new mutators: `setActivePane`, `moveCursor`, `setActiveItem`, and the selection pool modifiers (`setSelection`, `toggleSelection`, `clearSelection`).
- [ ] T004: [P] Implement a central target resolution helper (either in the store or as a utility hook) that evaluates `selectionPool` first, falling back to `treeCursor`/`descriptionCursor` based on `activePane`.
- [ ] T005: Update `useTreeActions.ts` modification actions (Delete, Rename, Move) to use the central target resolution logic instead of relying on implicit focus indices.
- [ ] T006: Update `useDescriptionActions.ts` modification actions to use the new target resolution logic.

## Phase 3: TUI Integration

_(Fixing the existing Terminal UI to work with the new headless logic)._

- [ ] T007: [P] Update the TUI Tree view components to use `treeCursor` for visual highlighting instead of deriving it from the old `focus` object.
- [ ] T008: [P] Update the TUI Description view components to use `descriptionCursor` for visual highlighting.
- [ ] T009: Update TUI keybindings to dispatch the new `setActivePane`, `moveCursor`, and `setActiveItem` actions appropriately (e.g., `l` sets `activeItem` and changes pane, `h` clears `activeItem` and changes pane).

---

## Phase 4: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (System Overview and Modules) and archive this specification.
- [ ] **Manual Verification:** Ensure any new domain vocabulary used during this feature was grilled and added to `CONTEXT.md` (Already completed: `Tree Cursor`, `Description Cursor`, `Active Pane`, `Active Item`, `Selection Pool`).
