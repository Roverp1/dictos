---

description: "Task list for Basic Cloud Sync implementation"
---

# Tasks: Basic Cloud Sync

**Input**: Design documents from `/specs/001-basic-cloud-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, CentralApiContract.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Path conventions: Monorepo with `packages/core/`, `packages/adapters/`, `apps/backend/`, `apps/tui/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and monorepo structure

- [ ] T001 Create monorepo structure for `packages/core`, `packages/adapters`, `apps/backend`, `apps/tui`
- [ ] T002 Initialize Bun workspaces and root `package.json` configuration
- [ ] T003 [P] Configure Drizzle ORM in `packages/adapters/db/schema/schema.ts` for local/central tables
- [ ] T004 [P] Configure TypeScript/Bun settings in all workspace packages

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core interfaces and shared logic MUST be complete before US implementation

- [ ] T005 Define `User` model and `AuthPort` in `packages/core/src/models/User.ts` and `packages/core/src/ports/outbound/AuthPort.ts`
- [ ] T006 Define `SyncPort` and `SyncOutboxRepository` in `packages/core/src/ports/outbound/`
- [ ] T007 Define Central DB schema in `apps/backend/src/db/schema.ts` (Users, Central Aggregates)
- [ ] T008 [P] Implement base `AuthService.ts` coordination logic in `packages/core/src/services/`
- [ ] T009 [P] Setup Central API routing structure in `apps/backend/src/routes/`

**Checkpoint**: Foundation ready - User Story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Account Registration and Authentication (Priority: P1) 🎯 MVP

**Goal**: Secure login and registration via Central REST API

**Independent Test**: Register a new user via TUI, verify record in Central DB, and successful local JWT storage.

### Implementation for User Story 1

- [ ] T010 [US1] Implement registration/login routes with Scrypt hashing in `apps/backend/src/routes/auth.ts`
- [ ] T011 [US1] Implement JWT issuance logic in `apps/backend/src/routes/auth.ts`
- [ ] T012 [P] [US1] Implement `CentralApiAdapter` in `packages/adapters/http/CentralApiAdapter.ts` for registration/login
- [ ] T013 [US1] Finalize `AuthService.ts` to handle local token management in `packages/core/src/services/`
- [ ] T014 [US1] Create Auth UI pages (Login/Register) in `apps/tui/src/pages/auth/`
- [ ] T015 [US1] Integrate Auth TUI pages with `AuthService` logic

**Checkpoint**: User Story 1 complete - Authentication and Registration functional.

---

## Phase 4: User Story 2 - Background Data Synchronization (Priority: P1)

**Goal**: Native libSQL sync for personal data (captures, definitions)

**Independent Test**: Create capture on Device A, trigger sync, verify it appears on Device B via Turso Cloud.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Implement `LibSqlSyncRepository.ts` in `packages/adapters/db/libsql-adapter/` wrapping `@libsql/client` `.sync()`
- [ ] T017 [US2] Implement `SyncService.ts` in `packages/core/src/services/` to trigger native sync
- [ ] T018 [US2] Implement background background daemon loop in `apps/tui/src/app/sync-daemon.ts`

**Checkpoint**: User Story 2 complete - Bidirectional sync for personal data working.

---

## Phase 5: User Story 3 - Shared Activity Sync (Priority: P2)

**Goal**: Additive outbox sync for activity aggregates (social stats)

**Independent Test**: Add capture in TUI, verify `outbox` record created, verify daemon pushes to Central API and clears outbox.

### Implementation for User Story 3

- [ ] T019 [US3] Implement `activity_triggers.sql` in `packages/adapters/db/schema/triggers/` for additive aggregates
- [ ] T020 [US3] Implement `LibSqlSyncOutboxRepository.ts` in `packages/adapters/db/libsql-adapter/` for reading/clearing outbox
- [ ] T021 [US3] Create sync push endpoint in `apps/backend/src/routes/sync.ts` to update central aggregates
- [ ] T022 [US3] Update `CentralApiAdapter.ts` in `packages/adapters/http/` with `pushOutbox` implementation
- [ ] T023 [US3] Update `SyncService.ts` to process outbox in `packages/core/src/services/`
- [ ] T024 [US3] Update `sync-daemon.ts` to call outbox processing alongside native sync

**Checkpoint**: User Story 3 complete - Daily activity statistics syncing to central server.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T025 [P] Documentation updates in docs/ reflecting cloud features
- [ ] T026 Code cleanup and verify strict Hexagonal Architecture boundaries
- [ ] T027 Verify offline resilience (TUI works without server for local data)
- [ ] T028 Performance check: UI responsiveness during background sync (<100ms)
- [ ] T029 Security check: Plain text JWT handling review and local hardening

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel once foundation is ready
  - US3 integrated into SyncService/Daemon after US2 structure is established

### Parallel Opportunities

- All Setup tasks (T001-T004)
- Port/Service/Schema definitions (T005-T009)
- Backend Auth (T010-T011) vs Client Adapter (T012)
- Native Sync Repository (T016) can be built while Auth UI (T014) is in progress

---

## Implementation Strategy

### MVP First (Auth + Sync)
1. Complete Setup + Foundational
2. Complete US1 (Auth) -> Verify registration
3. Complete US2 (Native Sync) -> Verify multi-device sync
4. Deliver core cloud capability

### Incremental Social
1. Add US3 (Outbox Aggregates) -> Verify social stats
2. Expand Social UI in subsequent features

---

## Notes

- All tasks are ID-labeled and file-path specific for LLM execution
- Triggers are strictly additive-only for this phase
- No tombstones used in US3 per research decisions
