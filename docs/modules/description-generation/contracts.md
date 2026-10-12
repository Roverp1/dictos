# Contracts & Interfaces: Description Generation

**Parent Module**: [domain.md](./domain.md)

## Core Contracts

`InstructionService` and `InstructionRepository` manage reusable Instructions. Core owns the following Model and Provider types; the catalog is metadata, not proof of account access or an execution route.

```ts
type ProviderId = string;
type ModelId = string;
type QualifiedModelId = string;
interface SelectedModel {
  providerId: ProviderId;
  modelId: ModelId;
}
interface ProviderConnection {
  providerId: ProviderId;
}
interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

interface CatalogProvider {
  id: ProviderId;
  name: string;
}
interface CatalogModel {
  providerId: ProviderId;
  modelId: ModelId;
  name: string;
  textGeneration: true;
  status: "active" | "alpha" | "beta";
  inputModalities: string[];
  outputModalities: string[];
  cost?: { input: number; output: number };
  protocol?: string;
}
interface ModelCatalog {
  source: "bundled" | "cache";
  fetchedAt: string;
  providers: CatalogProvider[];
  models: CatalogModel[];
}
```

`parseQualifiedModelId(value)` returns `SelectedModel | ValidationError`, splitting at the first `/` so the Model ID may contain slashes. `ModelCatalogService` requires a supported catalog Provider and a listed Model marked `textGeneration: true`, with text input, text output, an active/alpha/beta status, and no model-specific protocol override. The marker is derived during snapshot extraction or refresh; external catalog data cannot assert it directly. It does not check account entitlement.

```ts
interface ModelCatalogPort {
  get(): Promise<ModelCatalog | ModelCatalogError>;
  refresh(): Promise<ModelCatalog | ModelCatalogError>;
}
interface ModelCatalogStore {
  read(): Promise<ModelCatalog | StorageError | null>;
  replace(catalog: ModelCatalog): Promise<void | StorageError>;
}
class ModelCatalogService {
  supportedProviders(): Promise<CatalogProvider[] | ModelCatalogError>;
  configuredModels(input?: {
    providerId?: ProviderId;
  }): Promise<
    CatalogModel[] | ModelCatalogError | StorageError | ValidationError
  >;
  requireEligibleModel(
    id: QualifiedModelId
  ): Promise<SelectedModel | ModelCatalogError | ValidationError>;
  refresh(): Promise<ModelCatalog | ModelCatalogError>;
}
```

`ModelCatalogAdapter` reads a validated cache or falls back to its bundled models.dev snapshot (warning on a bad cache). Normal listing makes no network request. Explicit refresh fetches the fixed `https://models.dev/api.json` URL with time and size limits, requires entries for all five supported Providers, filters eligible text-generation Models, validates display fields, and replaces the cache only on success. The reviewed snapshot updater and runtime refresh use one upstream eligibility predicate: text input, text-only output, at least one generation signal (`temperature`, `tool_call`, or `structured_output`), a supported status, and no model-specific provider override. `FsModelCatalogStore` atomically reads/writes a validated version 2 cache at `<dataDir>/model-catalog.json`; version 1 lacks text-generation proof and falls back to the bundled snapshot without deleting the file. Failed or partial refresh leaves the prior cache intact.

```ts
interface ProviderConnectionRepository {
  create(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | ValidationError | StorageError>;
  findByProviderId(
    id: ProviderId
  ): Promise<ProviderConnectionWithCredential | StorageError | null>;
  findAll(): Promise<ProviderConnection[] | StorageError>;
  replaceKey(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | StorageError | null>;
  delete(id: ProviderId): Promise<ProviderConnection | StorageError | null>;
}
interface LocalState {
  deviceId: string;
  selectedModel: SelectedModel | null;
}
interface LocalStateRepository {
  getLocalState(): Promise<LocalState | StorageError>;
  resetLocalState(): Promise<LocalState | StorageError>;
  setSelectedModel(
    value: SelectedModel | null
  ): Promise<LocalState | StorageError>;
}
```

```ts
class ProviderConnectionService {
  connect(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<
    ProviderConnection | ValidationError | StorageError | ModelCatalogError
  >;
  replaceKey(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<
    ProviderConnection | ValidationError | NotFoundError | StorageError
  >;
  getConnections(): Promise<ProviderConnection[] | StorageError>;
  disconnect(
    id: ProviderId
  ): Promise<ProviderConnection | NotFoundError | StorageError>;
}
class ModelSelectionService {
  select(
    id: QualifiedModelId
  ): Promise<
    | SelectedModel
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  >;
  current(): Promise<
    | SelectedModel
    | null
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  >;
  resolve(input: {
    override?: QualifiedModelId;
  }): Promise<
    | SelectedModel
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  >;
}
```

Connect validates the catalog Provider and key, and refuses to overwrite an existing connection. Reconnect requires an existing connection. Disconnect clears a matching Selected Model before deleting its credential; a failure to clear leaves the credential, while a failed deletion can leave it configured but unselected. `FsProviderConnectionRepository` stores one key per Provider ID in owner-only `<dataDir>/providers.json`, serializes writes with a lock, and returns credentials only from targeted `findByProviderId` calls. Lists and mutation results contain only `providerId`.

`ModelSelectionService.select(id)`, `current()`, and `resolve({ override? })` validate catalog eligibility and a configured credential. `current()` returns `null` if unselected; a stale or disconnected choice returns an Error. `resolve` uses an explicit override for that call without saving it; without either choice it returns `ValidationError`, never a fallback Model. `FsLocalStateRepository` stores selection alongside `deviceId` in `<dataDir>/local-state.json`; selection updates preserve the device ID and reset clears selection. Neither credentials, selection, nor catalog cache enter the Dictionary database or Sync.

## Saved-Description Generation Boundary

`DescriptionGenerationPort.generate(request)` takes a credential-bearing connection, unqualified `modelId`, Instruction text, Entry and source Description context, requested Description Types, and either an existing Sense or the Entry's existing Senses. It returns `GeneratedProposal | DescriptionGenerationError | InvalidGenerationResponseError`; the proposal contains typed Descriptions and either an existing Sense ID or a new Sense name with a nullable duplicate candidate ID. No AI SDK type enters core.

`DescriptionGenerationService.createProposal({ sourceDescriptionId, instructionId, model: SelectedModel, targetTypes })` loads context, rechecks Model eligibility and the Provider Connection, invokes the port, and validates type coverage, content, Sense target, and duplicate-candidate ownership without writing. Its result is `DescriptionGenerationProposal | ValidationError | NotFoundError | ModelCatalogError | StorageError | DbError | DescriptionGenerationError | InvalidGenerationResponseError`. `commitProposal(proposal)` returns `DescriptionGenerationResult | DbError | GenerationConflictError` through `DescriptionGenerationRepository.commitProposal`.

`@dictos/ai-sdk` routes only `openai` to native `@ai-sdk/openai`, `google` to native `@ai-sdk/google`, and `openrouter`, `deepseek`, `groq` to `@ai-sdk/openai-compatible` at fixed Dictos-owned URLs. Catalog URLs, headers, and package names do not control requests. The adapter makes one non-streaming `generateText()` call with `Output.object` and local proposal checks; the SDK may retry retryable failures at most twice. Google disables provider structured outputs for this request; compatible routes disable structured outputs on their provider. Provider errors and invalid output become distinct safe Error values. The CLI installs the AI SDK warning bridge, which logs warning type/feature rather than raw warning text; provider request logs use status/retry metadata and sanitized causes, not API keys, headers, or raw responses.

## Unsaved Generation Boundary

`ScreenEntryGenerationService` depends only on Provider Connections, the Model Catalog, and `ScreenEntryGenerationPort`. It accepts text without saved record IDs, rechecks Model eligibility and a nonblank configured credential, and returns an in-memory result without opening or writing the Dictionary database. DTO shapes are in [Data Model & State](./data-model.md).

```ts
type ScreenGenerationFailure =
  | ValidationError
  | NotFoundError
  | ModelCatalogError
  | StorageError
  | DescriptionGenerationError
  | InvalidGenerationResponseError;

type ScreenEntryGenerationRequest = ScreenEntryText & {
  connection: ProviderConnectionWithCredential;
  modelId: string;
};
interface ScreenEntryGenerationPort {
  suggestSenses(
    input: ScreenEntryGenerationRequest & { limit: 20 }
  ): Promise<
    | SenseCandidate[]
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
  generateDescriptions(
    input: ScreenEntryGenerationRequest & {
      senseName: string | null;
      existingDescriptions: ScreenDescriptionInput[];
      targetTypes: DescriptionType[];
    }
  ): Promise<
    | GenerationDraft
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
}
class ScreenEntryGenerationService {
  suggestSenses(
    input: ScreenEntryText & { model: SelectedModel }
  ): Promise<SenseCandidate[] | ScreenGenerationFailure>;
  generateDescriptions(
    input: ScreenEntryText & {
      senseName: string | null;
      existingDescriptions: ScreenDescriptionInput[];
      model: SelectedModel;
      targetTypes: DescriptionType[];
    }
  ): Promise<GenerationDraft | ScreenGenerationFailure>;
}
```

Both operations require nonblank Entry text; blank captured Description text becomes `null`, and inline Instruction text may be empty. Suggestions allow at most 20 nonblank, distinct Sense names with nonblank `definition` previews. Generation requires nonempty, unique, known target Types and valid typed draft inputs. It requests all target Types, including those represented by nonempty drafts; nonempty drafts provide context, while blank drafts are omitted from that context. A blank Sense becomes `null`; a supplied nonblank Sense must be preserved exactly. Output must contain nonblank text for every requested Type and no other Types. Multiple Descriptions of one Type are allowed.

The service returns unsaved output; draft replacement belongs to `apps/overlay`. Explicit Generate snapshots the previous draft and request context before clearing checked-Type slots, including manual edits. Suggested Sense selection retains manual or edited text and card identities while clearing unedited generated text. Both apply output to existing empty slots before appending cards, preserve same-Type order, and use session history to restore prior text or cached results without repeating a completed request. Request-bound input fingerprints prevent undo/redo from applying pending or unused cached output to edited inputs. A Selected Model change invalidates pending generation and suggestions.

`AiSdkScreenEntryGenerationAdapter` uses the same fixed Provider routes and warning/failure sanitization as saved-Description generation. Each suggestion or generation invocation makes one non-streaming structured `generateText()` call, with at most two SDK retries and no core or CLI retry. Suggestions request up to 20 candidates; the adapter retains the first 20 and validates distinct names and previews of at most 240 characters. Draft generation supplies existing nonempty text as context and fixed task/JSON guidance even when Instruction text is blank. Provider failures return `DescriptionGenerationError`; malformed output returns `InvalidGenerationResponseError`.

## Reviewed Save Boundary

`ScreenEntrySaveService.save(input)` returns `ScreenEntrySaveResult | ValidationError | DbError` after validating current reviewed text. It calls `ScreenEntrySaveRepository.commit(input): Promise<ScreenEntrySaveResult | DbError>`, implemented by `SqliteScreenEntrySaveRepository` in one transaction. No Provider call or generation proposal is involved.

```ts
type ScreenEntrySaveInput =
  | {
      kind: "entry";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
    }
  | {
      kind: "sense";
      folderId: string;
      entryText: string;
      descriptionText: string | null;
      includeDescription: boolean;
      senseName: string;
      descriptions: ScreenDescriptionInput[];
    };
```

The CLI supplies the root Folder ID. Entry saves omit Sense and typed drafts and store any nonblank captured Description as unassigned `misc`. Sense saves require a nonblank name and at least one nonempty typed Description; they validate Types before omitting blank editors and include captured `misc` only when `includeDescription` is true. Nonempty reviewed text is preserved exactly. The transaction reuses the Entry identity, creates a new Sense for Sense saves, inserts the chosen Descriptions, and increments Activity once. Failure rolls back the whole save. See [Dictionary Management contracts](../dictionary-management/contracts.md) for persistence details.

## Overlay State Boundary

`OverlayCaptureStateStore.read()` and `replace(state)` return `Promise<OverlayCaptureLocalState | StorageError>`. `FsOverlayCaptureStateRepository` stores complete version 1 snapshots at `<dataDir>/overlay-capture/state.json`, validates known Types, queues writes within one repository instance, and atomically renames unique owner-only temporary files. Across processes, the last completed replacement wins; there is no persistent lock directory. Missing state returns empty Instruction text and `["definition"]`; corrupt state returns an Error without overwriting it, including during replacement. This file holds only Instruction input text and Type choices. State operations use filesystem storage directly without constructing either CLI dependency graph. Instruction edits never write database Instructions; the Selected Model remains shared device-local state in `local-state.json`.

## Command Client

`CliContext.getProviderDependencies()` lazily caches a provider-only graph (local storage, catalog, selection, logger, and screen generation service/adapter). Provider, catalog, selection, overlay suggestion, and overlay draft generation commands do not open `dictos.db`. `getDependencies()` extends this graph with the Dictionary database, saved-Description generation, reviewed saves, and other services. Saved Instruction listing reads the database. The central server is not on either generation path.

```text
dictos provider available
dictos provider connect <provider-id>
dictos provider reconnect <provider-id>
dictos provider list
dictos provider disconnect <provider-id> --yes
dictos models [provider-id] [--refresh] [--verbose]
dictos model select <provider/model>
dictos model current
dictos description generate <description-id> --instruction <instruction-id> --types <type,...> [--model <provider/model>] [--allow-duplicate]
```

Connect/reconnect read the API key through hidden terminal input, not a flag. `provider available` lists supported IDs, while `provider list` reports configured IDs without verifying account access. `models` prints sorted eligible qualified IDs for configured Providers (optional safe metadata); catalog source/date go to stderr. Generation resolves the saved choice or an invocation-only override before creating a proposal. A suspected duplicate requires confirmation or `--allow-duplicate`; discard writes nothing, and acceptance commits the same proposal without another provider request. Success prints the Sense ID then generated Description IDs. Exit codes are `0` success, `1` unexpected/dependency failure, `2` usage or required confirmation, `3` handled Error, and `4` Dictionary database in use.

The commit repository rechecks source Entry ownership and expected Sense assignment, and checks existing Sense identity before writes. New Sense creation, source assignment, and generated Description inserts run in one database transaction; a failed write rolls them back together. Stale proposals return `GenerationConflictError` rather than being committed.

### Provisional Overlay Commands

```text
dictos overlay suggest --json
dictos overlay generate --json
dictos overlay save --json
dictos overlay state read --json
dictos overlay state write --json
```

The three operation names are provisional. Suggest, generate, save, and state write read one bounded UTF-8 JSON line from stdin (at most 1 MiB before its terminating newline). Send `JSON.stringify(request) + "\n"`; multiline text is escaped inside JSON and never passed through shell arguments. Stream input requires the newline, not EOF. With `--json`, stdout contains exactly one newline-terminated envelope, including handled failures:

```ts
type OverlayCliResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
type SuggestRequest = ScreenEntryText;
type SuggestResult = { senses: SenseCandidate[] };
type GenerateRequest = ScreenEntryText & {
  senseName: string | null;
  descriptions: ScreenDescriptionInput[];
  targetTypes: DescriptionType[];
};
type GenerateResult = GenerationDraft;
type SaveRequest =
  | Omit<Extract<ScreenEntrySaveInput, { kind: "entry" }>, "folderId">
  | Omit<Extract<ScreenEntrySaveInput, { kind: "sense" }>, "folderId">;
type SaveResult = {
  entryId: string;
  senseId: string | null;
  capturedDescriptionId: string | null;
  descriptionIds: string[];
};
```

Nullable fields must be present as strings or `null`. Generate maps transport `descriptions` to core `existingDescriptions`. Both generation operations resolve the persisted Selected Model with no command override or automatic fallback. Save uses the full database graph but does not resolve a Model. State write accepts `OverlayCaptureLocalState`; read and write return that shape in `data` and require `--json`. The three operations also allow human-readable output when `--json` is omitted.

Error envelopes expose safe codes/messages without logs, progress text, ANSI codes, credentials, or raw Provider responses. Framing errors use `INVALID_REQUEST`, `REQUEST_TOO_LARGE`, or `REQUEST_READ_FAILED`; operation failures currently use `OPERATION_FAILED`, and a busy database uses `DATABASE_IN_USE`. Suggest/generate/save exit with `2` for invalid input, `3` for handled operation failure, or `4` for a busy database; state helper failures use `3`. Success uses `0`. Clients must check both envelope and exit status. Empty or malformed output or a child-process crash cannot confirm a Save outcome; retain drafts and do not auto-retry.

When dependency initialization provides a Logger, overlay operations and JSON Instruction-list failures write structured operation/error-type diagnostics to the local CLI log. Logs redact draft text, SQL bound values, credentials, and raw parser/Provider causes; diagnostics never enter JSON stdout.

The overlay also validates Save receipts before closing. IDs must be nonblank, typed Description IDs must be unique, and the captured Description ID cannot appear in the typed list. Sense/captured-record presence and typed Description count must agree with the submitted Save mode and nonblank text. A contradictory success receipt leaves the outcome unknown. A valid receipt blocks further saves and starts the local-state flush before exit; a flush failure keeps the overlay open without repeating the committed Save.

Picker support uses `dictos instruction list --json`, `dictos models [provider-id] --json`, `dictos model current --json`, and `dictos model select <provider/model>`. Reading saved Instructions and copying their text does not link subsequent inline edits to a record. Model selection persists the shared device choice.
