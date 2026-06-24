# Tasks: Action Notifications

**Format:** `[ID] [P?] [US?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[US]`: User story or success scenario from [spec.md](./spec.md).

## Phase 1: Foundation & Data Contracts

These tasks establish shared boundaries and package ownership before client work begins.

- [ ] T001: [US4] Add `NotificationOptions`, `NotificationContent`, `NotificationMessage`, `NotificationPromiseMessages`, and `Notifier` types in `packages/react`.
- [ ] T002: [US5] Export the Notifier types from `@dictos/react` public package exports.
- [ ] T003: [US5] Add required `notifier: Notifier` dependency to `DictosDependencies` and `DictosProvider` wiring in `packages/react/src/providers/dictos-provider.tsx`.
- [ ] T004: [US5] Update all `DictosProvider` composition roots to pass a placeholder notifier or fail compilation until client adapters are wired.

## Phase 2: Vendored TUI Toast Package

These tasks create the terminal-specific renderer package without changing shared React behavior yet.

- [ ] T005: [US5] Create `packages/tui-toast` with package name `@dictos/tui-toast` and workspace-compatible `package.json`, `tsconfig.json`, and source entrypoints.
- [ ] T006: [US5] Vendor the OpenTUI toast source from `tmp/opentui-ui/packages/toast` into `packages/tui-toast` with minimal source changes.
- [ ] T007: [US5] Replace external package metadata and imports in `@dictos/tui-toast` so it builds inside the Dictos monorepo.
- [ ] T008: [US2] Fix terminal toast title plus description rendering, including updates from loading to success or error states.
- [ ] T009: [US4] Ensure `@dictos/tui-toast` promise behavior treats resolved `Error` values as failures or exposes enough primitives for the TUI Notifier adapter to do so.
- [ ] T010: [US5] Replace `@opentui-ui/toast` dependency with `@dictos/tui-toast` in `apps/tui/package.json`.
- [ ] T011: [US5] Update TUI `Toaster` and direct toast imports to use `@dictos/tui-toast`.

## Phase 3: Client Notifier Adapters

These tasks connect platform renderers to the shared Notifier contract.

- [ ] T012: [P] [US5] Add a TUI Notifier adapter in `apps/tui` backed by `@dictos/tui-toast`.
- [ ] T013: [P] [US5] Add a Web Notifier adapter in `apps/web` backed by Sonner.
- [ ] T014: [US4] Implement shared adapter behavior so `notifier.promise()` returns `T | Error` and shows an error Notification when the operation resolves to `Error`.
- [ ] T015: [US3] Implement success-state mapping for `notifier.promise()` in both TUI and Web adapters.
- [ ] T016: [US2] Implement title plus description mapping for `notifier.error()` in both TUI and Web adapters.
- [ ] T017: [US5] Wire `tuiNotifier` into `apps/tui/src/app/main.tsx` `DictosProvider` dependencies.
- [ ] T018: [US5] Wire `webNotifier` into `apps/web/src/app/main.tsx` `DictosProvider` dependencies.

## Phase 4: Shared Dictionary Action Integration

These tasks make existing handled failures visible to users.

- [ ] T019: [US1] Update `useTreeActions.submitCreate` to notify on create Entry and create Folder service failures.
- [ ] T020: [US1] Update `useTreeActions.submitRename` to notify on rename Entry and rename Folder service failures.
- [ ] T021: [US1] Update `useTreeActions.confirmDelete` to notify on delete Entry and delete Folder service failures.
- [ ] T022: [US1] Update `useDescriptionActions.submitCreate` to notify on create Description service failures.
- [ ] T023: [US1] Update `useDescriptionActions.submitRename` to notify on rename Description service failures.
- [ ] T024: [US1] Update `useDescriptionActions.confirmDelete` to notify on delete Description service failures.
- [ ] T025: [US2] Format useful error descriptions from available error messages without exposing raw developer-only state failures to users.
- [ ] T026: [US1] Keep developer-state failures logged only unless the failure is user-actionable.

## Phase 5: Existing UI Flow Cleanup

These tasks remove throw-wrapper patterns where the new Notifier can handle errors-as-values cleanly.

- [ ] T027: [P] [US4] Update TUI auth flows to use `notifier.promise()` or a local Notifier-compatible helper instead of throwing returned errors for toast behavior.
- [ ] T028: [P] [US4] Update TUI sync flow to use `notifier.promise()` or a local Notifier-compatible helper instead of throwing returned errors for toast behavior.
- [ ] T029: [P] [US4] Update Web auth flows to use `notifier.promise()` or a local Notifier-compatible helper instead of throwing returned errors for toast behavior.
- [ ] T030: [P] [US4] Update Web sync flow to use `notifier.promise()` or a local Notifier-compatible helper so resolved `Error` values render as failures.

## Phase 6: Verification

These tasks prove the feature works across shared React, TUI, and Web boundaries.

- [ ] T031: [US1] Verify Dictionary create, rename, and delete service failures show error Notifications in the TUI client.
- [ ] T032: [US1] Verify Dictionary create, rename, and delete service failures show error Notifications in the Web client.
- [ ] T033: [US2] Verify a Notification with `message` and `description` renders as two visible lines in the TUI client.
- [ ] T034: [US2] Verify a Notification with `message` and `description` renders correctly in the Web client.
- [ ] T035: [US4] Verify `notifier.promise()` returns the same `Error` value when an operation resolves to `Error`.
- [ ] T036: [US3] Verify `notifier.promise()` returns the success value when an operation succeeds.
- [ ] T037: Run `bun run typecheck` from the workspace root.

## Phase 7: Absorb into Documentation

- [ ] T038: Update `docs/system-overview.md` to mention `@dictos/react` receives a platform-provided Notifier through `DictosProvider` for user-visible Notifications.
- [ ] T039: Update `docs/modules/dictionary-management/contracts.md` to document the Notifier dependency and Dictionary action failure Notification behavior.
- [ ] T040: Update `docs/modules/dictionary-management/data-model.md` to mention Notification-related headless UI state remains non-persisted and platform-rendered.
- [ ] T041: Confirm `CONTEXT.md` still contains the canonical `Notification` term and no new unresolved vocabulary was introduced.
- [ ] T042: Run `/docify.absorb` to archive this specification after implementation and documentation updates are complete.
