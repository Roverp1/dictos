# Tasks: Action Notifications

**Format:** `[ID] [P?] [US?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[US]`: User story or success scenario from [spec.md](./spec.md).

## Phase 1: Foundation & Data Contracts

These tasks establish shared boundaries and package ownership before client work begins.

- [x] T001: [US4] Add the full portable `Notifier` contract in `packages/react`, including `NotificationOptions`, `NotificationResult`, `NotificationPromiseResult`, `NotificationPromiseData`, and `Notifier`.
- [x] T002: [US5] Export the full Notifier API from `@dictos/react` public package exports.
- [x] T003: [US5] Add required `notifier: Notifier` dependency to `DictosDependencies` and `DictosProvider` wiring in `packages/react/src/providers/dictos-provider.tsx`.
- [x] T004: [US5] Update all `DictosProvider` composition roots to pass a placeholder notifier or fail compilation until client adapters are wired.

## Phase 2: Vendored TUI Toast Package

These tasks create the terminal-specific renderer package without changing shared React behavior yet.

- [x] T005: [US5] Create `packages/tui-toast` with package name `@dictos/tui-toast` and workspace-compatible `package.json`, `tsconfig.json`, and source entrypoints.
- [x] T006: [US5] Vendor the OpenTUI toast source from `tmp/opentui-ui/packages/toast` into `packages/tui-toast` with minimal source changes.
- [x] T007: [US5] Replace external package metadata and imports in `@dictos/tui-toast` so it builds inside the Dictos monorepo.
- [x] T008: [US5] Vendor or reimplement the small `@opentui-ui/utils` helpers (`mergeStyles`, `resolvePadding`) inside `packages/tui-toast` so the vendored package is self-contained.
- [x] T009: [US5] Add Bun timer types to `packages/tui-toast` so `setTimeout` and `setInterval` typecheck cleanly.
- [x] T010: [US2] Fix terminal toast title plus description rendering, including updates from loading to success or error states.
- [x] T011: [US4] keep `@dictos/tui-toast` promise behavior minimal and let the Dictos notifier adapter own resolved-Error handling.
- [x] T012: [US5] Replace `@opentui-ui/toast` dependency with `@dictos/tui-toast` in `apps/tui/package.json`.
- [x] T013: [US5] Update TUI `Toaster` and direct toast imports to use `@dictos/tui-toast`.

## Phase 3: Client Notifier Adapters

These tasks connect platform renderers to the shared Notifier contract.

- [x] T014: [P] [US5] Add a TUI Notifier adapter in `apps/tui` backed by `@dictos/tui-toast`.
- [x] T015: [P] [US5] Add a Web Notifier adapter in `apps/web` backed by Sonner.
- [x] T016: [US5] Implement the shared Notifier method mappings for `message`, `success`, `info`, `warning`, `error`, `loading`, and `dismiss` in both adapters.
- [x] T017: [US4] Implement shared `notifier.promise()` behavior so resolved `Error` values render as failures and successful values render as success Notifications.
- [x] T018: [US2] Implement title plus description mapping for notifications in both adapters, including promise loading/success/error states.
- [x] T019: [US5] Wire `tuiNotifier` into `apps/tui/src/app/main.tsx` `DictosProvider` dependencies.
- [x] T020: [US5] Wire `webNotifier` into `apps/web/src/app/main.tsx` `DictosProvider` dependencies.

## Phase 4: Shared Dictionary Action Integration

These tasks make existing handled failures visible to users.

- [ ] T021: [US1] Deferred to issue #33: update `useTreeActions.submitCreate` to notify on create Entry and create Folder service failures.
- [ ] T022: [US1] Deferred to issue #33: update `useTreeActions.submitRename` to notify on rename Entry and rename Folder service failures.
- [ ] T023: [US1] Deferred to issue #33: update `useTreeActions.confirmDelete` to notify on delete Entry and delete Folder service failures.
- [ ] T024: [US1] Deferred to issue #33: update `useDescriptionActions.submitCreate` to notify on create Description service failures.
- [ ] T025: [US1] Deferred to issue #33: update `useDescriptionActions.submitRename` to notify on rename Description service failures.
- [ ] T026: [US1] Deferred to issue #33: update `useDescriptionActions.confirmDelete` to notify on delete Description service failures.
- [ ] T027: [US2] Deferred to issue #33: format useful error descriptions from available error messages without exposing raw developer-only state failures to users.
- [ ] T028: [US1] Deferred to issue #33: keep developer-state failures logged only unless the failure is user-actionable.

## Phase 5: Existing UI Flow Cleanup

These tasks remove throw-wrapper patterns where the new Notifier can handle errors-as-values cleanly.

- [ ] T029: [P] [US4] Deferred: update TUI auth flows to use the new Notifier API instead of direct toast calls or throw-wrapper hacks.
- [ ] T030: [P] [US4] Deferred: update TUI sync flow to use the new Notifier API instead of direct toast calls or throw-wrapper hacks.
- [ ] T031: [P] [US4] Deferred: update Web auth flows to use the new Notifier API instead of direct toast calls or throw-wrapper hacks.
- [ ] T032: [P] [US4] Deferred: update Web sync flow to use the new Notifier API instead of direct toast calls or throw-wrapper hacks.

## Phase 6: Verification

These tasks prove the feature works across shared React, TUI, and Web boundaries.

- [ ] T033: [US1] Deferred: verify Dictionary create, rename, and delete service failures show error Notifications in the TUI client.
- [ ] T034: [US1] Deferred: verify Dictionary create, rename, and delete service failures show error Notifications in the Web client.
- [ ] T035: [US2] Deferred: verify a Notification with `message` and `description` renders as two visible lines in the TUI client.
- [ ] T036: [US2] Deferred: verify a Notification with `message` and `description` renders correctly in the Web client.
- [ ] T037: [US4] Deferred: verify `notifier.promise()` returns the same `Error` value when an operation resolves to `Error`.
- [ ] T038: [US3] Deferred: verify `notifier.promise()` returns the success value when an operation succeeds.
- [ ] T039: [US5] Deferred: verify the shared Notifier methods (`message`, `success`, `info`, `warning`, `error`, `loading`, `dismiss`) are available in both clients.
- [x] T040: Run `bun run typecheck` from the workspace root.

## Phase 7: Absorb into Documentation

- [x] T041: Update `docs/system-overview.md` to mention `@dictos/react` receives a platform-provided Notifier through `DictosProvider` for user-visible Notifications.
- [x] T042: Update `docs/modules/dictionary-management/contracts.md` to document the Notifier dependency and Dictionary action failure Notification behavior.
- [x] T043: Update `docs/modules/dictionary-management/data-model.md` to mention Notification-related headless UI state remains non-persisted and platform-rendered.
- [x] T044: Confirm `CONTEXT.md` still contains the canonical `Notification` term and no new unresolved vocabulary was introduced.
- [x] T045: Run `/docify.absorb` to archive this specification after implementation and documentation updates are complete.
