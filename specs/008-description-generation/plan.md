# Technical Plan: Description Generation

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

Description Generation will extend the existing hexagonal architecture rather than putting model calls or transaction logic in CLI handlers. `packages/core` will own Sense, typed Description, Instruction, Provider Connection, generation proposal, service, and outbound-port contracts. It will remain free of database drivers and AI libraries. Drizzle repositories will persist synced Dictionary data, filesystem storage will persist device-local Provider Connections, and a new `@dictos/ai-sdk` adapter package will implement generation and Model discovery through Vercel AI SDK. The Command Client will compose these pieces and remain responsible only for arguments, secure prompts, duplicate confirmation, output, and exit codes.

Generation will use two phases. `DescriptionGenerationService.createProposal()` loads the source Description, Entry, Instruction, Provider Connection, existing Senses, and their Descriptions, then asks the generation adapter for a validated proposal. This phase performs no writes. The CLI may display a duplicate warning and discard the in-memory proposal without another model request. `DescriptionGenerationService.commitProposal()` delegates to one domain-specific persistence port that atomically creates or reuses the Sense, assigns the source when needed, and inserts every generated Description. A dedicated commit port is smaller and safer than exposing a generic Unit of Work to core, while still keeping Drizzle transactions inside the database adapter.

The AI adapter will start with Vercel AI SDK's OpenAI-compatible provider and non-streaming `json_object` output. The expected shape is included in the request and validated locally before the adapter returns. Native provider `json_schema` modes, provider-specific SDKs, retries, and streaming remain replaceable adapter concerns and are not part of v1. The core service performs a second semantic validation for requested Description Type coverage, non-empty content, valid duplicate candidate IDs, and target ownership. Expected failures cross every boundary as tagged Error values.

Provider credentials will be stored outside the synced database in an owner-only `providers.json` file. This follows the existing device-local session boundary and prevents API keys from entering Sync or the central server. The filesystem repository will use atomic file replacement and never expose credentials through list results, normal CLI output, or logs. See [ADR 0008](../../docs/adr/0008-use-ai-sdk-for-description-generation.md) and [ADR 0009](../../docs/adr/0009-keep-provider-credentials-device-local.md).

## 2. Data Model & State Changes

### Core Models

```typescript
export type DescriptionType = "misc" | "translation" | "definition" | "example";

export interface Description {
  id: string;
  entryId: string;
  senseId: string | null;
  type: DescriptionType;
  text: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface NewDescription {
  entryId: string;
  type?: DescriptionType;
  text: string;
}

export interface Sense {
  id: string;
  entryId: string;
  name: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface NewSense {
  entryId: string;
  name: string;
}

export interface Instruction {
  id: string;
  name: string | null;
  text: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface NewInstruction {
  name?: string | null;
  text: string;
}
```

`NewDescription.type` defaults to `misc`, and newly created Descriptions start with `senseId: null`. Sense assignment is an explicit service operation. Sense names, Description text, and Instruction text must contain non-whitespace content. Instruction names are optional, but a supplied name must contain non-whitespace content. CLI commands reference Instructions by ID and display an empty name column when no name is present, followed by the full Instruction text. Sense and Description IDs remain UUIDv7 values because exact and semantic duplicate Senses are allowed and are not merged through deterministic identity.

### `senses` Table

| Column        | Type              | Constraints                        | Purpose                   |
| ------------- | ----------------- | ---------------------------------- | ------------------------- |
| `id`          | `text`            | Primary key, UUIDv7 default        | Stable Sense identity     |
| `entry_id`    | `text`            | Not null, Entry FK, delete cascade | Direct Entry ownership    |
| `name`        | `text`            | Not null                           | User-editable Sense label |
| `created_at`  | integer timestamp | Not null, current-time default     | Creation time             |
| `modified_at` | integer timestamp | Not null, current-time default     | Last modification time    |

Add an index on `senses.entry_id`. Do not add uniqueness on `(entry_id, name)`: duplicate names are valid, semantic equivalence cannot be enforced by text equality, and Sync avoids SQLite unique constraints for independently created content.

### `descriptions` Table

Add these columns to the source schema:

| Column     | Type   | Constraints                             | Purpose                 |
| ---------- | ------ | --------------------------------------- | ----------------------- |
| `sense_id` | `text` | Nullable Sense FK, `ON DELETE SET NULL` | Optional Sense grouping |
| `type`     | `text` | Not null, default `misc`, enum check    | Description Type        |

Add indexes on `descriptions.entry_id` and `descriptions.sense_id`. Keep direct `entry_id` ownership even when `sense_id` is present so unassigned Descriptions remain first-class and existing Entry queries stay simple. Core services enforce that an assigned Sense has the same `entryId`. Generic Description updates must reject moving a Description to another Entry while it remains assigned to a Sense.

`ON DELETE SET NULL` implements the safe default Sense deletion. Explicit cascading deletion remains application-controlled: `SqliteSenseRepository.delete({ cascade: true })` deletes associated Descriptions and the Sense inside one transaction.

### `instructions` Table

Keep the nullable `name` column alongside UUIDv7 `id`, required `text`, `created_at`, and `modified_at`. Names are optional, user-editable labels; duplicate names are allowed and do not identify Instructions. The CLI identifies Instructions by ID and prints ID, an empty name column when unnamed, and full text.

### Schema Generation

Update the Drizzle source schema first, then regenerate the migration set from the finalized schema. Do not design an incremental migration or data backfill for this feature. Fix `packages/db-core/drizzle.config.ts` to reference `./src/schema/schema.ts`, remove the old generated SQL and metadata, generate one fresh baseline, and recreate the custom lifecycle-trigger artifact for Entry, Folder, Description, Instruction, and Sense updates.

This is a deliberate pre-release destructive reset. Before Sync resumes, recreate local Bun databases, browser OPFS/WASM databases, and the remote Sync database so every replica starts from the same migration journal. Verify the fresh baseline through both Bun and WASM migration paths. Existing Dictionary data is not migrated by this plan.

### Device-Local Provider Connection Store

```typescript
export interface ProviderConnection {
  id: string;
  name: string;
  presetId: string | null;
  baseUrl: string;
}

export interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

export interface NewProviderConnection {
  name: string;
  presetId: string | null;
  baseUrl: string;
  apiKey: string;
}

interface ProviderConnectionFile {
  connections: ProviderConnectionWithCredential[];
}
```

`FsProviderConnectionRepository` stores this object at `<dataDir>/providers.json`. Connection IDs use `crypto.randomUUID()`. Writes use a unique temporary file in the same directory with mode `0o600`, then atomically rename it over the destination and enforce owner-only permissions on the resulting file. Every failed path removes the temporary file before returning. Reads validate every connection field at runtime instead of casting parsed JSON. Read, validation, parse, cleanup, and write failures return `StorageError`. List operations return `ProviderConnection[]` without API keys; only a targeted lookup for generation or Model discovery returns `ProviderConnectionWithCredential`.

Provider presets are static connection metadata, not a Model catalog. V1 ships presets for OpenAI, OpenRouter, DeepSeek, and Groq plus a custom connection path. Preset records are configuration data rather than hardcoded service branches. Models are discovered from the selected connection at runtime or supplied as a command argument; they are not stored in the synced database or required as a persisted default.

### Ephemeral Generation State

```typescript
export interface GeneratedDescription {
  type: DescriptionType;
  text: string;
}

export interface GenerationSenseContext {
  id: string;
  name: string;
  descriptions: GeneratedDescription[];
}

export type DescriptionGenerationTarget =
  | { kind: "existing"; senseId: string }
  | {
      kind: "new";
      senseName: string;
      duplicateCandidateSenseId: string | null;
    };

export interface DescriptionGenerationProposal {
  entryId: string;
  sourceDescriptionId: string;
  expectedSourceSenseId: string | null;
  target: DescriptionGenerationTarget;
  descriptions: GeneratedDescription[];
}

export interface DescriptionGenerationResult {
  sense: Sense;
  sourceDescription: Description;
  generatedDescriptions: Description[];
}
```

A proposal contains no API key, provider response, model metadata, token usage, or persisted IDs for generated rows. It lives only for the duration of the CLI command. `expectedSourceSenseId` lets the commit transaction reject stale proposals if the source Description changes while the provider request is running.

## 3. Interface Contracts & Boundaries

### Dictionary Repository Ports

```typescript
export interface DescriptionRepository {
  save(input: NewDescription): Promise<Description | DbError>;
  findById(id: string): Promise<Description | DbError | null>;
  findByEntry(entryId: string): Promise<Description[] | DbError>;
  findBySense(senseId: string): Promise<Description[] | DbError>;
  update(
    id: string,
    input: Partial<Pick<Description, "entryId" | "text" | "type">>
  ): Promise<Description | DbError>;
  assignSense(input: {
    descriptionId: string;
    senseId: string | null;
  }): Promise<Description | DbError>;
  delete(id: string): Promise<Description | DbError>;
}

export interface SenseRepository {
  save(input: NewSense): Promise<Sense | DbError>;
  findById(id: string): Promise<Sense | DbError | null>;
  findByEntry(entryId: string): Promise<Sense[] | DbError>;
  update(id: string, input: { name: string }): Promise<Sense | DbError>;
  delete(input: { id: string; cascade: boolean }): Promise<Sense | DbError>;
}

export interface InstructionRepository {
  save(input: NewInstruction): Promise<Instruction | DbError>;
  findById(id: string): Promise<Instruction | DbError | null>;
  findAll(): Promise<Instruction[] | DbError>;
  update(
    id: string,
    input: { name?: string | null; text?: string }
  ): Promise<Instruction | DbError>;
  delete(id: string): Promise<Instruction | DbError>;
}
```

`SqliteDescriptionRepository`, `SqliteSenseRepository`, and `SqliteInstructionRepository` implement these ports. Repository methods perform storage work and map failures; domain validation remains in services.

### `DescriptionGenerationRepository` (Atomic Persistence Port)

```typescript
export interface DescriptionGenerationRepository {
  commitProposal(
    proposal: DescriptionGenerationProposal
  ): Promise<DescriptionGenerationResult | DbError | GenerationConflictError>;
}
```

`SqliteDescriptionGenerationRepository` implements this port with one Drizzle transaction. It reloads the source Description and verifies `entryId` and `senseId` still match the proposal. For an existing target it requires `source.senseId`, `proposal.expectedSourceSenseId`, and `proposal.target.senseId` to be the same non-null ID, verifies that Sense belongs to the same Entry, and inserts all generated Descriptions. For a new target it requires the source to remain unassigned, creates the Sense, assigns the source without changing text or type, and inserts every generated Description.

All conflict and ownership checks run before the first write. Once writes begin, statement failures must reject the transaction or explicitly invoke the transaction rollback mechanism; repository code must not catch a statement failure and return an Error value from the transaction callback, because a resolved callback can commit earlier writes. The adapter catches the rejected transaction once outside the callback and converts it to `DbError`. Explicit cascading Sense deletion follows the same rollback rule.

### `ProviderConnectionRepository` (Device-Local Port)

```typescript
export interface ProviderConnectionRepository {
  save(
    input: NewProviderConnection
  ): Promise<ProviderConnection | StorageError>;
  findById(
    id: string
  ): Promise<ProviderConnectionWithCredential | StorageError | null>;
  findAll(): Promise<ProviderConnection[] | StorageError>;
  update(
    id: string,
    input: Partial<Omit<NewProviderConnection, "presetId">> & {
      presetId?: string | null;
    }
  ): Promise<ProviderConnection | StorageError>;
  delete(id: string): Promise<ProviderConnection | StorageError>;
}
```

The filesystem implementation must not log serialized connection objects, request headers, or credentials.

### Provider Presets and Model Discovery

```typescript
export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
}

export interface ProviderPresetCatalog {
  listPresets(): readonly ProviderPreset[];
  findPreset(id: string): ProviderPreset | null;
}

export interface ModelDiscoveryPort {
  listModels(
    connection: ProviderConnectionWithCredential
  ): Promise<string[] | ModelDiscoveryError>;
}
```

The AI SDK package supplies the static preset catalog and Model discovery adapter. Discovery calls the connection's OpenAI-compatible `/models` endpoint, returns sorted unique model IDs, and treats unsupported or malformed endpoints as `ModelDiscoveryError`. Manual `--model` input does not depend on discovery succeeding.

### `DescriptionGenerationPort` (Model Boundary)

```typescript
export type DescriptionGenerationRequest = {
  connection: ProviderConnectionWithCredential;
  modelId: string;
  instruction: string;
  entry: { id: string; text: string };
  sourceDescription: {
    id: string;
    text: string;
    type: DescriptionType;
    senseId: string | null;
  };
  targetTypes: DescriptionType[];
  target:
    | { kind: "existing"; sense: GenerationSenseContext }
    | { kind: "new"; existingSenses: GenerationSenseContext[] };
};

export type GeneratedProposal =
  | {
      target: { kind: "existing"; senseId: string };
      descriptions: GeneratedDescription[];
    }
  | {
      target: {
        kind: "new";
        senseName: string;
        duplicateCandidateSenseId: string | null;
      };
      descriptions: GeneratedDescription[];
    };

export interface DescriptionGenerationPort {
  generate(
    request: DescriptionGenerationRequest
  ): Promise<
    | GeneratedProposal
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
}
```

`@dictos/ai-sdk` implements this port with pinned, mutually compatible `ai` and `@ai-sdk/openai-compatible` versions recorded in `bun.lock`. It creates the provider with `createOpenAICompatible({ supportsStructuredOutputs: false })` and calls `generateText()` once with `Output.object({ schema })`. The schema is a runtime JSON/Standard Schema definition for the relevant proposal shape. In this mode the provider request uses `json_object`; AI SDK parses and validates the result locally. Access to the output getter is also wrapped at the adapter boundary because it may fail after the request resolves.

The adapter must accept an injected `fetch` implementation for boundary tests. It does not retry, stream, persist, or decide whether a duplicate is accepted.

For a new Sense, the generated object contains a required non-empty Sense name, generated Descriptions, and either one supplied existing Sense ID or `null` as the duplicate candidate. For an existing Sense, the generated object contains only generated Descriptions; the target Sense ID comes from trusted request context rather than model output.

### Core Services

```typescript
export class SenseService {
  createSense(input: NewSense): Promise<Sense | DbError | ValidationError>;
  getSenseById(id: string): Promise<Sense | DbError | null>;
  getSensesForEntry(entryId: string): Promise<Sense[] | DbError>;
  renameSense(input: {
    id: string;
    name: string;
  }): Promise<Sense | DbError | ValidationError>;
  deleteSense(input: {
    id: string;
    cascade?: boolean;
  }): Promise<Sense | DbError>;
}

export class DescriptionService {
  createDescription(
    input: NewDescription
  ): Promise<Description | DbError | ValidationError>;
  getDescriptionById(id: string): Promise<Description | DbError | null>;
  getDescriptionsForEntry(entryId: string): Promise<Description[] | DbError>;
  updateDescription(input: {
    id: string;
    entryId?: string;
    text?: string;
    type?: DescriptionType;
  }): Promise<Description | DbError | ValidationError>;
  assignToSense(input: {
    descriptionId: string;
    senseId: string;
  }): Promise<Description | DbError | NotFoundError | ValidationError>;
  detachFromSense(
    descriptionId: string
  ): Promise<Description | DbError | NotFoundError>;
  deleteDescription(id: string): Promise<Description | DbError>;
}

export class InstructionService {
  createInstruction(
    input: NewInstruction
  ): Promise<Instruction | DbError | ValidationError>;
  getInstructionById(id: string): Promise<Instruction | DbError | null>;
  getInstructions(): Promise<Instruction[] | DbError>;
  updateInstruction(input: {
    id: string;
    name?: string | null;
    text?: string;
  }): Promise<Instruction | DbError | ValidationError>;
  deleteInstruction(id: string): Promise<Instruction | DbError>;
}

export class ProviderConnectionService {
  createConnection(input: {
    name: string;
    presetId?: string;
    baseUrl?: string;
    apiKey: string;
  }): Promise<ProviderConnection | StorageError | ValidationError>;
  getConnections(): Promise<ProviderConnection[] | StorageError>;
  updateConnection(input: {
    id: string;
    name?: string;
    presetId?: string | null;
    baseUrl?: string;
    apiKey?: string;
  }): Promise<ProviderConnection | StorageError | ValidationError>;
  deleteConnection(id: string): Promise<ProviderConnection | StorageError>;
  getPresets(): readonly ProviderPreset[];
  discoverModels(
    connectionId: string
  ): Promise<string[] | StorageError | NotFoundError | ModelDiscoveryError>;
}

export class DescriptionGenerationService {
  createProposal(input: {
    sourceDescriptionId: string;
    instructionId: string;
    providerConnectionId: string;
    modelId: string;
    targetTypes: DescriptionType[];
  }): Promise<
    | DescriptionGenerationProposal
    | DbError
    | StorageError
    | NotFoundError
    | ValidationError
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;

  commitProposal(
    proposal: DescriptionGenerationProposal
  ): Promise<DescriptionGenerationResult | DbError | GenerationConflictError>;
}
```

`InstructionService` rejects empty text, an empty supplied name, and updates that contain neither `name` nor `text`. Passing `name: null` explicitly clears the optional name.

`DescriptionGenerationService.createProposal()` rejects an empty target list, duplicate target values, missing source/Entry/Instruction/connection, generated types outside the requested set, missing requested types, empty generated text, an empty new Sense name, and a duplicate candidate ID not present in the supplied context. It groups existing Senses with their Descriptions before calling the adapter. Duplicate detection is a valid proposal state, not an Error.

`DescriptionService` receives both Description and Sense repositories. Assignment loads both objects and rejects cross-Entry ownership. Updating `entryId` on an assigned Description is rejected until it is detached. Existing TUI and Web callers may continue omitting `type`, receiving the `misc` and unassigned defaults without adding generation UI.

### Error Contracts

Add tagged errors in `packages/core/src/errors.ts`:

```typescript
class DescriptionGenerationError extends Error {}
class InvalidGenerationResponseError extends Error {}
class GenerationConflictError extends Error {}
class ModelDiscoveryError extends Error {}
```

Implement them with `errore.createTaggedError`, including stable operation/reason fields and a safe `cause`. Remove the deprecated `LlmPort` and `LlmError`; no shipped caller requires compatibility. Continue using `ValidationError`, `NotFoundError`, `DbError`, and `StorageError` at their existing boundaries. AI SDK promise rejections are converted at the adapter boundary with `.catch()`, and synchronous output access/parsing is converted with `errore.try` where needed.

Third-party provider errors must be sanitized before they become a cause: retain only safe provider name, operation, HTTP status, provider code, and message fields. Do not attach raw request options, headers, or response objects as causes. No error, log event, or CLI output may contain an API key, Authorization header, full Provider Connection record, or raw provider request. A user rejecting a duplicate is a cancellation outcome, not a domain Error.

## 4. Command Client Contracts

### Sense Commands

```text
dictos sense create --entry <entry-id> --name <name>
dictos sense list --entry <entry-id>
dictos sense update <sense-id> --name <name>
dictos sense delete <sense-id> --yes [--cascade]
```

Default deletion relies on `ON DELETE SET NULL`; `--cascade` selects transactional Description deletion. Both paths require `--yes`.

### Description Command Changes

```text
dictos description create --entry <entry-id> --text <text> [--type <type>]
dictos description update <description-id> [--text <text>] [--type <type>] [--entry-id <entry-id>]
dictos description assign-sense <description-id> --sense <sense-id>
dictos description detach-sense <description-id>
dictos description generate <description-id> --instruction <instruction-id> --provider <connection-id> --model <model-id> --types <type,...> [--allow-duplicate]
dictos description list --entry <entry-id>
```

`create` defaults to `misc`. `list` prints ID, type, Sense ID or `-`, and text. `--types` is a comma-separated, unique list parsed into the fixed enum before service invocation.

When generation returns a new-Sense proposal with a duplicate candidate, an interactive terminal prints the candidate Sense and generated proposal, then asks whether to create the duplicate. Rejecting prints a short discarded message, writes nothing, and exits successfully. In a non-interactive terminal, the command returns the expected-failure exit code unless `--allow-duplicate` was provided. `--allow-duplicate` commits the already-generated proposal; it does not make a second model request.

On successful generation, print the Sense ID followed by each generated Description ID. Existing-Sense generation prints the reused Sense ID. Do not print provider credentials, raw model output, or generation metadata.

### Instruction Commands

```text
dictos instruction create --text <text> [--name <name>]
dictos instruction list
dictos instruction update <instruction-id> [--text <text>] [--name <name> | --clear-name]
dictos instruction delete <instruction-id> --yes
```

Create prints the Instruction ID. List prints ID, optional name, and full text; unnamed Instructions use an empty name column. `--name` and `--clear-name` are mutually exclusive. Update requires at least one changed field. Update and delete are quiet on success.

### Provider Commands

```text
dictos provider presets
dictos provider connect --name <name> --preset <preset-id>
dictos provider connect --name <name> --base-url <url>
dictos provider list
dictos provider models <connection-id>
dictos provider update <connection-id> [--name <name>] [--preset <preset-id> | --base-url <url>] [--replace-key]
dictos provider delete <connection-id> --yes
```

`connect` and `--replace-key` read the API key through a hidden terminal prompt; an API-key command flag is not supported. Preset and custom base URL options are mutually exclusive. `list` prints safe connection metadata only. `models` attempts live discovery and prints model IDs; failure does not prevent a user from passing a manual Model ID to generation. CLI automation commands (e.g. CRUD actions like `create`, `delete`, etc) exit silently on success, following unix style, while auth/connection related commands print success message, and updated status when usefull.

### Terminal Prompt Boundary

Generalize the password-only prompt into a reusable terminal boundary:

```typescript
export interface TerminalPrompt {
  readSecret(label: string): Promise<string | PromptError>;
  confirm(label: string): Promise<boolean | PromptError>;
}
```

Auth password input and Provider Connection API-key input use `readSecret()`. Duplicate confirmation uses `confirm()`. The implementation restores terminal mode and removes listeners on success, cancellation, and errors. Non-interactive secret reads and confirmations return `PromptError`; generation handles non-interactive duplicate confirmation through `--allow-duplicate` instead.

### CLI Composition Root

Extend `CliDependencies` with `SenseService`, `InstructionService`, `ProviderConnectionService`, and `DescriptionGenerationService`. Replace `CliContext.passwordPrompt` with `CliContext.terminalPrompt`; terminal input remains a CLI boundary rather than a core service dependency. Extract `createCliProgram(context): Command` so tests can construct and parse a program without importing an entrypoint that immediately reads process arguments. Keep `parseAsync()` only in the executable entrypoint.

`createCliDependencies()` creates the new SQLite repositories against the shared database, `FsProviderConnectionRepository` against the shared data directory, and the AI SDK adapter. Generation remains unavailable to TUI/Web composition roots. Update React Description action call sites for the new object-argument service signature, and wire `SenseRepository` wherever `DescriptionService` is constructed in TUI, Web, and CLI; no generation state or UI is added to those clients.

No central-server endpoint is added. The CLI calls the selected provider directly.

## 5. Package and File Boundaries

| Area                   | Planned changes                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`        | Add Sense, Provider Connection, generation types, services, ports, and errors; remove deprecated LLM artifacts; retain optional Instruction names |
| `packages/db-core`     | Add Sense schema/repositories, Instruction repository, typed Description support, and atomic generation commit repository                         |
| `packages/fs-storage`  | Add owner-only, atomic Provider Connection repository                                                                                             |
| `packages/ai-sdk`      | New adapter package for presets, Model discovery, and validated OpenAI-compatible generation                                                      |
| `apps/cli`             | Add Sense, Instruction, Provider, and generation commands; generalize terminal prompts; wire dependencies                                         |
| `packages/react`       | Update Description service call signatures only; add no generation state or actions                                                               |
| `apps/tui`, `apps/web` | Wire Sense repository into Description service; add no generation UI                                                                              |

The new adapter package depends on `@dictos/core`, `@dictos/errore`, `ai`, and `@ai-sdk/openai-compatible`. Core does not import any AI SDK type. The adapter accepts injected `fetch`, making provider HTTP the only mocked boundary in its tests.

## 6. Verification Strategy

Use behavioral tests at the public boundary and follow `docs/testing.md`.

- Core unit tests cover pure validation, target type coverage, and invalid duplicate candidate IDs. Service tests replace only the outbound generation boundary with deterministic proposals.
- Database integration tests use a real local Turso database and verify type defaults, same-Entry service behavior, default Sense detachment, explicit cascade deletion, existing-Sense target identity, new-Sense atomic commit, stale proposal rejection, and full rollback after a controlled failure following the first write.
- Fresh-bootstrap tests apply the regenerated baseline through Bun and WASM migration paths and verify tables, indexes, foreign keys, checks, and lifecycle triggers before Sync is re-enabled.
- Filesystem integration tests use a real temporary directory and verify CRUD, runtime validation of every connection field, corrupted JSON errors, redacted list results, and `0o600` permissions. Failed writes remove secret-bearing temporary files before returning an Error.
- AI adapter tests inject a deterministic HTTP boundary and verify `json_object` parsing, local schema validation, provider errors, invalid output, Model discovery, and absence of automatic retries. No paid provider call runs in the default test suite.
- CLI behavior tests exercise command parsing and outputs through a constructed Command instance, using real local storage where practical and replacing only terminal/provider boundaries. They verify hidden key input, duplicate accept/discard, non-interactive refusal, `--allow-duplicate`, and exit-code mapping.
- Run package tests, `bun run typecheck`, and formatting checks after implementation.
