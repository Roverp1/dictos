# Tasks: Shared React Logic Package (@dictos/react)

**Format:** `[ID] [P?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.

## Phase 1: Foundation & Data Contracts

- [x] T001: Initialize `packages/react` with `package.json` (defining `peerDependencies` for react, react-router, zustand).
- [x] T002: [P] Define core types for the shared package (`TreeItem`, `DictionaryState`, `FocusState`).
- [x] T003: Implement `DictosProvider` and `useServices` hook for dependency injection.
- [x] T003.1: Create `@dictos/logger` package and `PinoLoggerAdapter` for infrastructure dependency injection.

## Phase 2: Core Logic & Interfaces

- [x] T004: Migrate `useDictionaryStore` (Zustand) from `apps/tui` to `@dictos/react`.
- [x] T005: Implement the granular action logic (`requestCreate`, `submitCreate`, etc.) in the shared logic layer.
- [x] T006: [P] Implement `useDictionary` "Main Hook" that aggregates state and actions.
- [~] T007: [P] Implement `DictionaryRoutes` component using core `react-router`. *(Deferred: Current architecture relies on state-based pathStack navigation, not URL-based. Deferring URL routing to a future web-specific feature).*

## Phase 3: TUI Migration & Integration

- [x] T008: Update `apps/tui` to use `@dictos/react` for its Dictionary page logic.
- [x] T009: Verify that `apps/tui` properly handles "Request/Submit" UI states (input fields, confirmation prompts).
- [x] T010: Remove redundant local logic and stores from `apps/tui/src/pages/dictionary/model/`.

---

## Phase N: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (System Overview and Modules) and archive this specification.
- [ ] **Manual Verification:** Ensure the `Dictionary` definition in `CONTEXT.md` aligns with the implementation.
