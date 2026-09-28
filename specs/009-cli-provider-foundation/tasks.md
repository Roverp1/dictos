# Tasks: CLI Provider Foundation

**Format:** `[ID] [P?] [US?] Description`

- `[P]`: Can proceed alongside other marked tasks in the same phase after its stated prerequisites are complete; tasks that edit the same file are not parallel.
- `[US1]`: Connect, inspect, replace, and disconnect a supported Provider without exposing its API key.
- `[US2]`: Browse eligible Models from a bundled/cached catalog and refresh it safely.
- `[US3]`: Select a device-local Model and use an explicit one-command override.
- `[US4]`: Generate validated Descriptions through native OpenAI, native Google, and supported OpenAI-compatible Providers.

## Phase 1: Foundation & Data Contracts

_(Finish shared contracts before implementing adapters or Command Client changes. No synced database schema or migration is needed.)_

- [ ] T001 [US1] [US3]: Replace generated connection IDs, names, presets, and stored endpoints with `ProviderId`, qualified Model ID parsing, safe Provider Connection shapes, and `SelectedModel` in `packages/core/src/models/`; keep Provider credentials out of safe return types.
- [ ] T002 [P] [US2]: Add normalized `CatalogProvider`, `CatalogModel`, `ModelCatalog`, `ModelCatalogError`, `ModelCatalogPort`, and `ModelCatalogStore` in their core contract files after T001. Preserve source/date metadata and typed Error-value failures; leave shared barrel exports for T007.
- [ ] T003 [P] [US1] [US3]: Redefine `ProviderConnectionRepository` by Provider ID and extend `LocalStateRepository` with `setSelectedModel()` in their existing core port files after T001. Define duplicate creation, missing connection, and device-ID preservation outcomes; leave shared barrel exports for T007.
- [ ] T004 [P] [US4]: Change the `DescriptionGenerationService.createProposal()` input to a validated Provider/Model pair and update the core request/return types for catalog errors after T001. Keep `DescriptionGenerationPort.generate()` and atomic `commitProposal()` contracts intact.
- [ ] T005 [P] [US2]: Prepare a reviewed, reproducible models.dev snapshot for the supported Provider IDs with text input/output and status metadata. Record source, retrieval date, and hash, and place the MIT copyright/permission notice in a dedicated `THIRD_PARTY_NOTICES.md` file instead of scattering it through code.
- [ ] T006 [P] [US4]: Add AI SDK 6-compatible native `@ai-sdk/openai` and `@ai-sdk/google` 3.x dependencies to `packages/ai-sdk/package.json` and update `bun.lock` without upgrading `ai` 6 or `@ai-sdk/openai-compatible` 2.
- [ ] T007 [US1] [US2] [US3] [US4]: Add the Phase 1 core model/port/error barrel exports after T002-T004, review the dependency lockfile against the plan, and confirm `packages/db-core` has no schema or migration changes. Full package typechecks wait until old callers are migrated in Phase 3.

## Phase 2: Core Logic & Interfaces

_(Storage adapters, catalog loading, and provider request work can proceed on separate files once Phase 1 contracts compile.)_

- [ ] T008 [P] [US1]: Rework `packages/fs-storage/src/repositories/fs-provider-connection-repository.ts` for one Provider Connection per supported ID. Use real-filesystem tests for duplicate create, explicit API-key replacement, safe listing, atomic writes, `0o600` permissions, corrupt data, concurrent writers, and failure cleanup.
- [ ] T009 [P] [US3]: Rework `packages/fs-storage/src/repositories/fs-local-state-repository.ts` to store `selectedModel` without regenerating `deviceId`. Test fresh state, existing device-only state, invalid files, atomic and concurrent selection updates, and explicit reset through a real temporary directory.
- [ ] T010 [P] [US2]: Implement the `ModelCatalogStore` filesystem adapter for `<dataDir>/model-catalog.json` with atomic replacement and validated reads. Test missing, corrupt, and failed writes using real temporary files.
- [ ] T011 [P] [US2]: Implement the bundled-snapshot and fixed-URL models.dev adapter in `packages/ai-sdk` using T005 and the catalog storage port. Test injected external fetch, supported-Provider filtering, text eligibility, deterministic ordering, safe names/IDs, timeout/size limits, offline fallback, and a refresh failure that retains the last good cache.
- [ ] T012 [US2]: Implement `ModelCatalogService.supportedProviders()`, `configuredModels()`, `requireEligibleModel()`, and `refresh()` against the finished catalog adapter and real Provider Connection storage from T008-T011. Test rejection of unknown/deprecated Models and unsupported model-specific protocol overrides, preserve slashes after the first `provider/model` separator, and keep catalog metadata out of SDK/endpoint selection.
- [ ] T013 [P] [US1]: Implement `ProviderConnectionService.connect()`, `replaceKey()`, `getConnections()`, and `disconnect()` after T012. Validate supported IDs and nonempty keys, never overwrite a configured key on connect, and clear only a matching Selected Model before deletion; test both partial-failure orders with real storage.
- [ ] T014 [P] [US3]: Implement `ModelSelectionService.select()`, `current()`, and `resolve()` after T012 against the real catalog, connection, and local-state adapters. Test no default fallback, ineligible/stale choices, missing credentials, and explicit overrides that leave the saved choice untouched.
- [ ] T015 [P] [US4]: Probe Google `Output.object` with `structuredOutputs: false` and the nullable `duplicateCandidateSenseId` using pinned AI SDK 6 packages and injected provider HTTP. Prove the request shape and local validation before enabling native Google; revise the plan if the expected `null` result cannot be preserved.
- [ ] T016 [P] [US4]: Update `DescriptionGenerationService.createProposal()` after T012 to recheck catalog eligibility and load credentials by Provider ID. Keep existing Description Type, Sense, duplicate-candidate, no-write proposal, and commit behavior; cover rejected/unconfigured Models before any provider request.
- [ ] T017 [US4]: Implement the Dictos-owned provider routing map in `@dictos/ai-sdk` after T015. Use native OpenAI and Google plus fixed, reviewed OpenAI-compatible routes for OpenRouter, DeepSeek, and Groq; never execute catalog-supplied `npm`, URL, or headers. Add injected-fetch tests for each route, including native OpenAI's request mode versus the compatible `json_object` request, bounded retries, nullable output, invalid proposals, and secret-safe errors/logs.
- [ ] T018 [US1] [US2] [US3] [US4]: Run the new isolated catalog, storage, service, and adapter behavioral tests. Identify remaining old preset/discovery call sites for T024; defer full package typechecks until those callers move.

## Phase 3: Command Client UI & Integration

_(The Command Client is this feature's only new user interface. TUI and Web UI work are out of scope.)_

- [ ] T019 [US1] [US2] [US3] [US4]: Split `apps/cli/src/app/dependencies.ts`, `context.ts`, and `types.ts` into a cached provider-only dependency graph and a Dictionary-backed graph. Compose the shared catalog, services, logging, and local files once; do not open or migrate `dictos.db` for provider, `models`, or `model` commands.
- [ ] T020 [P] [US1]: Replace `apps/cli/src/commands/provider.ts` with `available`, `connect <provider-id>`, `reconnect <provider-id>`, `list`, and `disconnect <provider-id> --yes`. Use hidden terminal input, check existing/missing IDs before prompting, and list only safe configured-credential status; test through the public CLI with real local files.
- [ ] T021 [P] [US2]: Add `dictos models [provider-id] [--refresh] [--verbose]` in its own CLI command module after T019. Print sorted qualified IDs to stdout, safe optional metadata, and catalog source/date or failures to stderr; test unknown providers, cached/offline output, and truthful refresh exit codes.
- [ ] T022 [P] [US3]: Add `dictos model select <provider/model>` and `dictos model current` in their own CLI command module after T019. Verify local persistence, no initial selection, stale choice errors, and no credential or database access in the output.
- [ ] T023 [P] [US4]: Update `apps/cli/src/commands/description.ts` after T019 to accept optional `--model <provider/model>`, resolve the Selected Model, and remove `--provider`. Keep generated IDs, duplicate confirmation, non-TTY refusal, `--allow-duplicate`, and expected exit codes; test both default and one-command override paths.
- [ ] T024 [US1] [US2] [US3] [US4]: After T020-T023, register the new groups in `apps/cli/src/app/program.ts`, update CLI service types/test setup, and remove the obsolete preset/live-discovery commands, ports, adapters, composition, and exports without compatibility shims. Keep `dictos auth` reserved for Dictos account login, then run affected package typechecks.
- [ ] T025 [P] [US1] [US2] [US3]: With T024 complete, use an isolated real local Turso database held open by another process to prove provider/catalog/selection CLI commands still work. Check observable stdout, stderr, exit codes, and that no Dictionary database initialization occurs.
- [ ] T026 [P] [US4]: With T024 complete, exercise Description Generation through the CLI using real local Turso and filesystem storage with only provider HTTP simulated. Prove selected/overridden Models, supported route choice, duplicate accept/discard, and no extra provider call or partial Dictionary write.

## Phase 4: Verification & Hardening

_(Close security and failure gaps before updating the living documentation.)_

- [ ] T027 [P] [US1] [US3]: Verify credential-file and local-state contention, atomic write failures, invalid legacy provider test files, preserved device-only `local-state.json`, disconnect cleanup, and `0o600` final permissions through real filesystem integration tests.
- [ ] T028 [P] [US2]: Verify bundled-first offline listing, valid-cache precedence, corrupt-cache warnings, refresh failure without data loss, new eligible Models after refresh, and terminal-safe output for hostile catalog names/IDs. Do not use unreviewed output snapshots or live catalog calls in default tests.
- [ ] T029 [P] [US4]: Verify native OpenAI/Google and the retained compatible routes, nullable Sense candidate behavior, provider rejection, retry ceiling, invalid proposals, safe warning/error logging, and unchanged atomic commit behavior. Test database writes through real local Turso, not an internal DB mock.
- [ ] T030 [US1] [US2] [US3] [US4]: Run affected package tests, `bun run test`, `bun run typecheck`, and Prettier checks; inspect CLI output, saved files, and logs for leaked API keys or raw provider data. Fix failures before marking the feature complete.
- [ ] T031 [US4]: When a suitable key and quota exist, perform and record an optional live Gemini Description Generation smoke test outside CI. Do not make free-tier access or a paid request a release gate.

## Phase 5: Absorb into Documentation

_(This is the final phase. Do not archive the feature while living contracts still describe presets, custom endpoints, or live-only Model discovery.)_

- [ ] T032 [P] [US2] [US4]: Update `docs/system-overview.md` with the final Model Catalog, SDK adapter routing, CLI-only scope, and device-local Provider Connection and Selected Model boundaries.
- [ ] T033 [P] [US1] [US3] [US4]: Update `docs/modules/description-generation/domain.md` with supported Provider setup, eligible Model selection, device-local preference, generation workflow, and deferred custom/OAuth/TUI behavior.
- [ ] T034 [P] [US1] [US2] [US3]: Update `docs/modules/description-generation/data-model.md` with Provider ID-keyed credentials, `local-state.json` Selected Model, snapshot/cache metadata, and the explicit absence of synced schema changes.
- [ ] T035 [P] [US1] [US2] [US4]: Update `docs/modules/description-generation/contracts.md` with the final catalog, storage, selection, generation, error, and Command Client interfaces; remove stale preset and `/models` contracts while retaining proposal/commit rules.
- [ ] T036 [P] [US1] [US3]: Update `docs/modules/sync/domain.md` to explain why Provider Connections, the Model Catalog cache, and the Selected Model remain device-local while Dictionary content Syncs.
- [ ] T037 [P] [US3]: Update `docs/modules/sync/data-model.md` with `LocalState.selectedModel` and the device-local catalog cache; make clear that neither requires a synced database schema change.
- [ ] T038 [P] [US1] [US3]: Update `docs/modules/sync/contracts.md` with the Provider Connection, Selected Model, and catalog storage boundaries outside Sync and Mirroring.
- [ ] T039 [US1] [US2] [US3] [US4]: Verify the implemented vocabulary against `CONTEXT.md` and the trade-offs against ADRs 0008-0011. Reconcile any differences without rewriting current-reality docs until the code actually matches.
- [ ] T040 [US1] [US2] [US3] [US4]: Run `/docify.absorb`, review its changes to living documentation, and archive `specs/009-cli-provider-foundation/` only after T032-T039 are complete.
