# Tasks: [FEATURE NAME]

**Format:** `[ID] [P?] [@DevName?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[@DevName]`: Optional assignment for cross-developer collaboration.

## Phase 1: Foundation & Data Contracts

_(These tasks block the rest of the work. Establish the shared interfaces and database schemas first so devs can parallelize later)._

- [ ] T001: Implement database migrations for `[tables]`.
- [ ] T002: [P] Define core TypeScript interfaces/types in `packages/core`.

## Phase 2: Core Logic & Interfaces

_(Backend and Frontend can often work in parallel here based on Phase 1 contracts)_

- [ ] T003: [@Backend] Implement `[Service]` logic and expose `[Endpoint]`.
- [ ] T004: [@Frontend] Create mock API client and wire up global state/store.

## Phase 3: UI & Integration

- [ ] T005: Wire up the UI/Frontend to the real `[Service]/[Endpoint]`.
- [ ] T006: Handle loading/error states in the UI.

---

<!--
  CRITICAL: The last phase always automates the Documentation Handshake.
  Do not close this feature without completing this phase.
-->

## Phase N: Absorb into Documentation

- [ ] Run `/docify.absorb` to automatically update the living Documentation (System Overview and Modules) and archive this specification.
- [ ] **Manual Verification:** Ensure any new domain vocabulary used during this feature was grilled and added to `CONTEXT.md`.
