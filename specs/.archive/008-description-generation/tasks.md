# Tasks: Description Generation

**Format:** `[ID] [P?] [US?] Description`

- `[P]`: Task can be done in parallel with other `[P]` tasks in the same phase.
- `[US1]`: Organize typed Descriptions with Senses.
- `[US2]`: Manage reusable Instructions.
- `[US3]`: Configure Provider Connections and select Models.
- `[US4]`: Generate Descriptions into new or existing Senses.
- `[US5]`: Prevent partial writes, secret leaks, and accidental duplicate Senses.

## Phase 1: Foundation & Data Contracts

_(These contracts and schema sources block implementation in later phases.)_

- [ ] T001 [P] [US1]: Add `DescriptionType`, extend `Description`, add `Sense`, define creation inputs, implement non-empty validation, and export the models from `packages/core/src/models/`.
- [ ] T002 [P] [US2]: Update the Instruction model and validation in `packages/core/src/models/instruction.ts` so `name` remains nullable and optional while supplied names and text must be non-empty.
- [ ] T003 [P] [US3]: Add safe Provider Connection, credential-bearing connection, Provider preset, and Model identifier types in `packages/core/src/models/` without exposing credentials through summary types.
- [ ] T004 [P] [US4] [US5]: Add generation request, context, proposal, target, result, and generated Description types plus tagged generation/model/conflict errors in `packages/core`; remove the deprecated `LlmPort` and `LlmError` exports.
- [ ] T005 [US1] [US2]: Finalize `DescriptionRepository`, `SenseRepository`, and `InstructionRepository` ports with the exact plan contracts and export them from `packages/core/src/ports/outbound/`.
- [ ] T006 [US3]: Add `ProviderConnectionRepository`, `ProviderPresetCatalog`, and `ModelDiscoveryPort` contracts and exports in `packages/core`.
- [ ] T007 [US4] [US5]: Add `DescriptionGenerationPort` and atomic `DescriptionGenerationRepository` contracts and exports in `packages/core`.
- [ ] T008 [US1] [US2]: Update `packages/db-core/src/schema/schema.ts` with `senses`, Description `type`/`senseId`, indexes, enum checks, nullable optional Instruction names, and the planned foreign-key deletion behavior.
- [ ] T009 [US1] [US2]: Fix the Drizzle schema path, regenerate a fresh baseline migration set and metadata, and recreate lifecycle triggers for Entry, Folder, Description, Instruction, and Sense without adding incremental migration/backfill logic.
- [ ] T010 [P] [US3] [US4]: Create the `@dictos/ai-sdk` workspace package with pinned compatible `ai` and `@ai-sdk/openai-compatible` dependencies, exports, TypeScript configuration, and injectable-fetch adapter skeletons.
- [ ] T011 [US1] [US2] [US3] [US4]: Run core and db-core typechecks to prove all Phase 1 contracts and generated schema artifacts agree before implementation begins.

## Phase 2: Core Logic & Interfaces

_(Persistence adapters and core services can proceed in parallel once Phase 1 contracts compile.)_

- [ ] T012 [P] [US1] [US5]: Implement `SqliteSenseRepository`, including lookup, rename, default detach deletion, explicit cascading deletion, pre-write checks, and rollback-safe transaction handling.
- [ ] T013 [P] [US1]: Extend `SqliteDescriptionRepository` with type persistence, `findById`, `findBySense`, explicit Sense assignment/detachment, and typed updates.
- [ ] T014 [P] [US2]: Implement `SqliteInstructionRepository` with optional name CRUD and ID-based lookup/list behavior.
- [ ] T015 [P] [US3] [US5]: Implement `FsProviderConnectionRepository` at `<dataDir>/providers.json` with runtime shape validation, UUID connection IDs, redacted list results, atomic temporary-file replacement, cleanup on failure, and mode `0o600`.
- [ ] T016 [US4] [US5]: Implement `SqliteDescriptionGenerationRepository.commitProposal()` with complete pre-write validation, strict existing-Sense identity checks, atomic new-Sense assignment/inserts, and rollback on every post-write failure.
- [ ] T017 [P] [US1]: Implement and unit-test `SenseService` validation, retrieval, rename, and deletion behavior.
- [ ] T018 [P] [US1]: Extend and unit-test `DescriptionService` for defaults, typed updates, same-Entry assignment, detachment, and rejection of Entry moves while assigned.
- [ ] T019 [P] [US2]: Implement and unit-test `InstructionService`, including optional name creation/update/clearing and rejection of empty updates.
- [ ] T020 [P] [US3]: Implement the static Provider preset catalog for OpenAI, OpenRouter, DeepSeek, and Groq plus custom endpoint resolution.
- [ ] T021 [P] [US3] [US5]: Implement Model discovery through the selected connection's `/models` endpoint with sorted unique IDs, sanitized failures, and injected fetch.
- [ ] T022 [US3] [US5]: Implement and test `ProviderConnectionService` for preset/custom connection validation, safe CRUD, secure credential replacement, preset listing, and Model discovery orchestration.
- [ ] T023 [US4] [US5]: Implement the AI SDK Description Generation adapter with `createOpenAICompatible`, one non-streaming `generateText` invocation, `Output.object`, `json_object` mode, runtime schema validation, at most two retries for retryable failures, a sanitized warning bridge, and sanitized provider errors.
- [ ] T024 [US4] [US5]: Implement and unit-test `DescriptionGenerationService.createProposal()` for context loading, existing/new target selection, requested-type coverage, duplicate candidate validation, and zero persistence.
- [ ] T025 [US4] [US5]: Implement and test `DescriptionGenerationService.commitProposal()` delegation and ensure accepted proposals return the persisted Sense, unchanged source Description, and generated Descriptions.
- [ ] T026 [P] [US5]: Add adapter-level tests proving provider errors, Error causes, logs, and returned values cannot expose API keys, Authorization headers, request objects, or raw responses.
- [ ] T027 [US1] [US2] [US3] [US4] [US5]: Run core, db-core, fs-storage, and AI-adapter tests and typechecks before CLI integration.

## Phase 3: UI & Integration

_(The only new user interface is the Command Client; TUI/Web receive compatibility wiring but no generation UI.)_

- [ ] T028 [P] [US3] [US4]: Extract `createCliProgram(context): Command` and keep process argument parsing in the executable entrypoint so commands can be tested without auto-running the CLI.
- [ ] T029 [P] [US3] [US5]: Replace the password-only prompt boundary with `TerminalPrompt.readSecret()` and `TerminalPrompt.confirm()`, preserving hidden input, cancellation, non-TTY errors, listener cleanup, and terminal-mode restoration.
- [ ] T030 [US1] [US2] [US3] [US4]: Extend CLI dependency construction with Sense, Instruction, Provider Connection, Model discovery, generation, atomic commit adapters/services, and structured AI SDK warning routing.
- [ ] T031 [P] [US1]: Add `sense create/list/update/delete` commands with ID output, `--yes`, default detachment, and explicit `--cascade` behavior.
- [ ] T032 [P] [US1]: Extend Description commands with `--type`, typed list output, `assign-sense`, `detach-sense`, and same-Entry validation errors.
- [ ] T033 [P] [US2]: Add Instruction CRUD commands with optional `--name`, `--clear-name`, ID-based references, and list output containing ID, empty optional name column, and full text.
- [ ] T034 [P] [US3] [US5]: Add Provider commands for presets, connect, list, models, update, and delete using `providers.json`, hidden API-key prompts, redacted output, and the agreed connection-success messages.
- [ ] T035 [US4] [US5]: Add `description generate` with Instruction/Provider/Model/type parsing, generated proposal display, duplicate accept/discard prompt, non-TTY refusal, `--allow-duplicate`, and one-call commit behavior.
- [ ] T036 [P] [US1]: Update shared React Description action call sites for the object-argument service contract without adding Sense or generation state to `@dictos/react`.
- [ ] T037 [P] [US1]: Wire `SenseRepository` into `DescriptionService` construction in TUI and Web while preserving existing Description behavior and adding no generation UI.
- [ ] T038 [US1] [US2] [US3] [US4] [US5]: Add CLI behavior tests through `createCliProgram()` for Sense, typed Description, Instruction, Provider, Model discovery, generation, duplicate confirmation, output, and exit-code contracts.
- [ ] T039 [US5]: Audit CLI output and logging paths to ensure Provider credentials and raw model data never reach stdout, stderr, or log files.
- [ ] T040 [US1] [US2] [US3] [US4]: Run CLI, React, TUI, and Web typechecks and relevant tests after integration.

## Phase 4: Verification & Hardening

_(Prove destructive schema reset, transaction safety, and external boundaries before documentation is absorbed.)_

- [ ] T041 [US1] [US2]: Apply the regenerated baseline to a fresh Bun Turso database and verify tables, indexes, checks, foreign keys, and lifecycle triggers.
- [ ] T042 [P] [US1] [US2]: Add cross-platform browser E2E coverage that applies the regenerated baseline through the WASM migrator to fresh OPFS storage and verifies schema and trigger behavior without adding a package-local WASM test runner.
- [ ] T043 [US1] [US2]: Reset development Bun databases, browser OPFS databases, and the development remote Sync database so no replica retains the previous migration journal before Sync is re-enabled.
- [ ] T044 [US4] [US5]: Add a runner-neutral repository contract backed by a real database that forces failure after the first generation write and proves the Sense, source assignment, and generated Descriptions all roll back.
- [ ] T045 [P] [US1] [US5]: Add runner-neutral repository contracts backed by a real database for default Sense detachment, explicit cascade deletion and rollback, stale expected Senses, and wrong existing-Sense targets; cover cross-Entry assignment in the core Description service.
- [ ] T046 [P] [US3] [US5]: Add real-filesystem tests for malformed-but-valid JSON, temporary-file cleanup, final `0o600` mode, credential redaction, and connection update/delete behavior.
- [ ] T047 [P] [US3] [US4] [US5]: Add deterministic provider-boundary tests for preset/custom endpoints, Model discovery, valid proposals, malformed objects, unsupported output, sanitized warnings/errors, and at most two retries for retryable failures.
- [ ] T048 [P] [US4] [US5]: Add CLI integration coverage for interactive duplicate acceptance/discard and scripted `--allow-duplicate` without issuing a second model request.
- [ ] T049 [US1] [US2] [US3] [US4] [US5]: Run all package tests, `bun run typecheck`, Prettier checks, and security-sensitive secret searches; fix every failure before documentation work.
- [ ] T050 [US3] [US4]: Perform a CLI smoke test against a controlled OpenAI-compatible endpoint covering Provider setup, Model selection, Instruction selection, new-Sense generation, and existing-Sense append.

## Phase 5: Absorb into Documentation

_(Do not close the feature until the living documentation matches the implemented behavior.)_

- [ ] T051 [P] [US3] [US4]: Update `docs/system-overview.md` with the final Description Generation package boundary, AI SDK adapter, CLI-only scope, and device-local Provider credential rule.
- [ ] T052 [P] [US1]: Update `docs/modules/dictionary-management/domain.md` with Sense lifecycle, typed Description rules, same-Entry assignment, multiple Descriptions per type, and detach/cascade deletion behavior.
- [ ] T053 [P] [US1]: Update `docs/modules/dictionary-management/data-model.md` with Sense, Description Type, nullable `senseId`, indexes, foreign keys, and lifecycle fields.
- [ ] T054 [P] [US1]: Update `docs/modules/dictionary-management/contracts.md` with Sense/Description services, repository ports, and atomic generation persistence ownership.
- [ ] T055 [P] [US2] [US3] [US4] [US5]: Create `docs/modules/description-generation/domain.md` covering Instruction, Provider Connection, Model selection, proposal/commit workflows, duplicate handling, and feature boundaries.
- [ ] T056 [P] [US2] [US3] [US4]: Create `docs/modules/description-generation/data-model.md` covering Instructions, `providers.json`, safe Provider Connection shapes, and ephemeral generation proposals.
- [ ] T057 [P] [US3] [US4] [US5]: Create `docs/modules/description-generation/contracts.md` covering generation, Model discovery, Provider storage, AI SDK adapter, CLI, Error-value, and transaction boundaries.
- [ ] T058 [P] [US1] [US3]: Update `docs/modules/sync/domain.md`, `data-model.md`, and `contracts.md` to document synced Senses/Description fields, device-local Provider credentials, destructive baseline reset, and possible cross-device semantic duplicates.
- [ ] T059 [US1] [US2] [US3] [US4]: Manually verify that implemented terminology matches `CONTEXT.md`; add no technical-only terms and resolve any new product vocabulary before archiving.
- [ ] T060 [US3] [US4] [US5]: Verify ADR 0008 and ADR 0009 still match the implemented AI adapter and credential storage decisions, updating consequences only if implementation changed them.
- [ ] T061 [US1] [US2] [US3] [US4] [US5]: Run `/docify.absorb` to merge the completed specification into living documentation and archive `specs/008-description-generation/`.
