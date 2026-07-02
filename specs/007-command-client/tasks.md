# Tasks: Command Client

**Format:** `[ID] [P] [US] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[US]`: User story or workflow covered by the task.

## Phase 1: Foundation & Data Contracts

These tasks establish shared contracts and project structure before command handlers are built.

- [ ] T001 [US-SharedData]: Create `apps/cli/package.json` with Bun scripts, TypeScript dependencies, `commander`, and workspace dependencies matching the CLI composition needs.
- [ ] T002 [US-SharedData]: Add `apps/cli/tsconfig.json` using the same strict TypeScript expectations as the existing app packages.
- [ ] T003 [US-SharedData]: Add the CLI entrypoint structure under `apps/cli/src/`, including `index.ts`, command registration modules, and shared CLI utilities.
- [ ] T004 [US-Folder]: Add `FolderService.getFolderById(id)` in `packages/core/src/services/folder-service.ts` using the existing `FolderRepository.findById()` port.
- [ ] T005 [US-SharedData]: Define CLI-local types for `CliDependencies`, `CliExitCode`, `CliOutput`, and `PasswordPrompt` under `apps/cli/src/`.
- [ ] T006 [US-SharedData]: Confirm no database migrations are needed because the CLI uses existing `dictos.db`, `session.json`, and `local-state.json` state.

## Phase 2: CLI Composition & Infrastructure

These tasks wire the CLI to the same local services and adapters used by the TUI.

- [ ] T007 [US-SharedData]: Implement `createCliDependencies()` to resolve `getDictosDataDir()`, open `dictos.db` with `BunTursoClient.create()`, load `local-state.json`, and compose repositories and core services.
- [ ] T008 [US-SharedData]: Configure CLI logging to a CLI-specific log file such as `dictos-cli.log` without writing logs to stdout.
- [ ] T009 [US-DatabaseInUse]: Map failures from opening the shared Turso database into exit code `4` and `error: Dictos database is already open by another process` where detectable.
- [ ] T010 [US-Auth]: Implement `PasswordPrompt.readPassword()` for terminal password input without accepting password flags or environment variables.
- [ ] T011 [US-SharedData]: Implement `CliOutput` helpers so result data writes to stdout and errors write to stderr.
- [ ] T012 [US-SharedData]: Implement shared error mapping for expected `Error` values returned by services using errors-as-values control flow.

## Phase 3: Command Registration

These tasks create the Commander.js command tree without filling every command action yet.

- [ ] T013 [US-SharedData]: Register the root `dictos` program with version/help behavior and global error handling.
- [ ] T014 [P] [US-Auth]: Register `dictos auth register`, `dictos auth login`, `dictos auth logout`, and `dictos auth status` command signatures.
- [ ] T015 [P] [US-Folder]: Register `dictos folder create`, `dictos folder update`, `dictos folder delete`, and `dictos folder list` command signatures.
- [ ] T016 [P] [US-Entry]: Register `dictos entry create`, `dictos entry update`, `dictos entry delete`, and `dictos entry list` command signatures.
- [ ] T017 [P] [US-Description]: Register `dictos description create`, `dictos description update`, `dictos description delete`, and `dictos description list` command signatures.
- [ ] T018 [P] [US-Sync]: Register `dictos sync run` command signature.

## Phase 4: Command Actions

These tasks implement the real user-facing behavior behind the registered commands.

- [ ] T019 [US-Auth]: Implement `auth register` to prompt for password, call `AuthService.register()`, save the shared session through existing core behavior, and stay quiet on success.
- [ ] T020 [US-Auth]: Implement `auth login` to prompt for password, call `AuthService.login()`, save the shared session through existing core behavior, and stay quiet on success.
- [ ] T021 [US-Auth]: Implement `auth logout` to call `AuthService.logout()` without requiring `--yes`.
- [ ] T022 [US-Auth]: Implement `auth status` to call `AuthService.getCurrentUser()` and print human-readable authenticated/unauthenticated state.
- [ ] T023 [US-Folder]: Implement `folder create --name <name> [--parent <folder-id>]`, defaulting omitted parent to the root Folder and printing the created Folder ID.
- [ ] T024 [US-Folder]: Implement `folder update <folder-id> --name <name>` by calling `FolderService.renameFolder()` and printing nothing on success.
- [ ] T025 [US-Folder]: Implement `folder delete <folder-id> --yes`, refusing to run without `--yes`, and printing nothing on success.
- [ ] T026 [US-Folder]: Implement `folder list [--parent <folder-id>]`, defaulting omitted parent to root subfolders and printing human-readable rows.
- [ ] T027 [US-Entry]: Implement `entry create --folder <folder-id> --text <text>` and print the created Entry ID.
- [ ] T028 [US-Entry]: Implement `entry update <entry-id> --text <text>` and print nothing on success.
- [ ] T029 [US-Entry]: Implement `entry delete <entry-id> --yes`, refusing to run without `--yes`, and printing nothing on success.
- [ ] T030 [US-Entry]: Implement `entry list --folder <folder-id>` and print human-readable rows.
- [ ] T031 [US-Description]: Implement `description create --entry <entry-id> --text <text>` and print the created Description ID.
- [ ] T032 [US-Description]: Implement `description update <description-id> --text <text>` and print nothing on success.
- [ ] T033 [US-Description]: Implement `description delete <description-id> --yes`, refusing to run without `--yes`, and printing nothing on success.
- [ ] T034 [US-Description]: Implement `description list --entry <entry-id>` and print human-readable rows.
- [ ] T035 [US-Sync]: Implement `sync run` to reconnect with stored Turso credentials when available, call `SyncService.sync()`, and print nothing on success.

## Phase 5: Verification & Integration

These tasks prove the CLI behaves as a supported Dictos client, not a separate tool with separate data.

- [ ] T036 [P] [US-SharedData]: Add typecheck coverage for `apps/cli` and include it in the monorepo typecheck flow.
- [ ] T037 [P] [US-Auth]: Verify auth commands against the existing server auth endpoints with expected success and failure output.
- [ ] T038 [P] [US-Folder]: Verify Folder create/update/delete/list behavior against the shared local database.
- [ ] T039 [P] [US-Entry]: Verify Entry create/update/delete/list behavior against the shared local database.
- [ ] T040 [P] [US-Description]: Verify Description create/update/delete/list behavior against the shared local database.
- [ ] T041 [US-Sync]: Verify `dictos sync run` performs the existing push-and-pull sync operation and stays quiet on success.
- [ ] T042 [US-SharedData]: Verify data created through the CLI is visible to the TUI through the shared `dictos.db`.
- [ ] T043 [US-DatabaseInUse]: Verify a CLI command fails fast with the documented database-in-use error when another Dictos process holds the database open.
- [ ] T044 [US-SharedData]: Run `bun run typecheck` from the workspace root.

## Phase 6: Absorb into Documentation

These tasks keep living documentation aligned with the implemented feature.

- [ ] T045 [Docs]: Update `docs/system-overview.md` to list `/apps/cli/` as the Command Client and describe it as a first-class script-oriented Dictos interface.
- [ ] T046 [Docs]: Update `docs/modules/dictionary-management/contracts.md` with the CLI command surface for Folder, Entry, and Description operations, including ID-based references and quiet-success output.
- [ ] T047 [Docs]: Update `docs/modules/sync/contracts.md` or `docs/modules/sync/domain.md` with `dictos sync run` as the CLI-facing full Sync action if the implemented behavior adds user-facing Sync constraints.
- [ ] T048 [Docs]: Update auth-related documentation if an auth module exists by implementation time; otherwise record CLI auth behavior in `docs/system-overview.md` until a dedicated auth module exists.
- [ ] T049 [Docs]: Run `/docify.absorb` to archive this specification after the implementation and living documentation are complete.
- [ ] T050 [Docs]: Manually verify no new domain vocabulary needs to be added to `CONTEXT.md`; keep `Command Client` out unless it becomes product vocabulary used outside this feature.
- [ ] T051 [Docs]: Document deferred features, polish, flags, and etc, in github issues.
