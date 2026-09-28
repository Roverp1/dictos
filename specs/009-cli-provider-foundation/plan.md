# Technical Plan: CLI Provider Foundation

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

Keep Description Generation's two-phase proposal and atomic commit boundary. `packages/core` will own Provider Connection, Model Catalog, Selected Model, and eligibility contracts without importing AI libraries or filesystem code. `@dictos/ai-sdk` will supply the catalog and implement the existing generation port with a small, explicit Provider routing table: native OpenAI and Google, plus the supported OpenAI-compatible routes needed for OpenRouter, DeepSeek, and Groq. These routes cover two protocols without an SDK for every provider in models.dev. The catalog can suggest Models but cannot select an SDK package, endpoint, or header for a credential. See [ADR 0010](../../docs/adr/0010-use-catalog-backed-provider-ids.md) and [ADR 0011](../../docs/adr/0011-keep-catalog-out-of-provider-execution.md).

Model discovery will read a reviewed models.dev snapshot bundled with Dictos, then prefer a validated device-local cache when one exists. An explicit refresh downloads catalog data from a fixed HTTPS URL, validates and filters it to supported Providers, and atomically replaces the cache. The bundled snapshot supports offline listing without a first-run fetch. The catalog also avoids reliance on each Provider's `/models` endpoint, which is not universally available. Refresh failures return Error values without destroying the old cache or printing a success message. The snapshot includes upstream attribution and a repeatable update path; the catalog is metadata, not proof of account access or Model behavior.

The Command Client will have two lazy dependency paths. Provider, catalog, and Selected Model commands use only device-local storage, the catalog, and logging; other commands still open the shared Turso database. Generation resolves an explicit qualified Model ID or the device-local Selected Model, validates eligibility and the Provider Connection, then calls the existing core generation service. The core service checks eligibility again for future non-CLI callers. No synced schema or central-server endpoint changes are needed. Device-local credentials remain protected under [ADR 0009](../../docs/adr/0009-keep-provider-credentials-device-local.md), and bounded non-streaming requests, sanitization, and local proposal validation remain under [ADR 0008](../../docs/adr/0008-use-ai-sdk-for-description-generation.md).

## 2. Data Model & State Changes

### Core Identity and Catalog Models

Replace the generated Provider Connection ID, `presetId`, mutable connection name, and stored `baseUrl` with a stable Provider ID. Keep `ModelId` as the Provider's exact API ID, which may itself contain `/`; only the external `provider/model` form is qualified. Core types are strings with runtime validation rather than a list of SDK-specific packages.

```typescript
type ProviderId = string;
type ModelId = string;
type QualifiedModelId = string;

interface ProviderConnection {
  providerId: ProviderId;
}

interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

interface SelectedModel {
  providerId: ProviderId;
  modelId: ModelId;
}

interface CatalogProvider {
  id: ProviderId;
  name: string;
}

interface CatalogModel {
  providerId: ProviderId;
  modelId: ModelId;
  name: string;
  status: "active" | "alpha" | "beta";
  inputModalities: string[];
  outputModalities: string[];
  cost?: { input: number; output: number };
}

interface ModelCatalog {
  source: "bundled" | "cache";
  fetchedAt: string;
  providers: CatalogProvider[];
  models: CatalogModel[];
}
```

`parseQualifiedModelId(value)` splits at the first slash, rejects empty parts and control characters, and returns `SelectedModel | ValidationError`. A Model is eligible only when its catalog record is not deprecated, has text input and output, and the Dictos-owned routing table supports its Provider and any required model-specific protocol. Do not use `structured_output` alone as an eligibility gate: catalog flags may be missing, and local validation is still required. Treat missing modalities or an unsupported model-level protocol override as ineligible. Never turn a Model ID missing from the local catalog into an unchecked provider request. A newly cataloged Model becomes eligible after refresh without editing a built-in Model list.

### Device-Local Files

No Turso table, Drizzle schema, migration, or Sync change is required. Replace the unshipped `providers.json` test-data shape with one credential per supported Provider ID:

```typescript
type ProviderConnectionFile = {
  version: 1;
  connections: Record<ProviderId, { apiKey: string }>;
};

type LocalState = {
  deviceId: string;
  selectedModel: SelectedModel | null;
};

type ModelCatalogCacheFile = {
  version: 1;
  fetchedAt: string;
  providers: CatalogProvider[];
  models: CatalogModel[];
};
```

Store the credential map in `<dataDir>/providers.json` with owner-only `0o600` permissions. Safe list, connect, replace, and disconnect results contain only `providerId`; only targeted generation reads receive `apiKey`. Keep the Selected Model in `<dataDir>/local-state.json` alongside the existing `deviceId`; selection updates must preserve that ID. A missing state file initializes `{ deviceId, selectedModel: null }`. Treat an existing file with a valid `deviceId` and no `selectedModel` as an unselected device, without changing its ID; genuinely malformed files return `StorageError` rather than silently regenerating `deviceId`. `resetLocalState()` remains an explicit device-identity reset and clears the selection. Existing provider test files can be deleted and recreated; no provider credential migration is added.

Store the filtered snapshot as a bundled asset in `@dictos/ai-sdk` and the downloaded cache at `<dataDir>/model-catalog.json`. Record its upstream URL, snapshot retrieval date and hash, and required models.dev MIT notice (any mit/licence notes should be put in a dedicated `THIRD_PARTY_NOTICES.md` file, instead of being written in every single code file). Prefer a validated cache over the bundled snapshot; if the cache cannot be read or validated, log a sanitized warning and use the snapshot without deleting it. Normal reads do not fetch. Refresh uses a bounded timeout and response size, validates the supported slice before writing, and replaces a same-directory temporary file atomically. On failure it leaves the previous cache intact and returns a tagged `ModelCatalogError`. Validate IDs and sanitize catalog-supplied names and other displayed text before storing or printing them so control sequences cannot change terminal output. Provider and local-state read-modify-write operations must serialize concurrent CLI processes to prevent lost credentials or a changed `deviceId`; failed lock acquisition returns an Error value rather than overwriting another writer's work.

Credential deletion and clearing `selectedModel` span two files, not one transaction. On disconnect, first clear a matching selection, then delete the credential. If clearing fails, retain the credential and return the storage failure. If deletion fails afterward, report it and leave the credential configured but unselected; do not silently choose another Model. Any stale selection found later is rejected before a provider request.

## 3. Interface Contracts & Boundaries

### Model Catalog Ports

`packages/core` owns the normalized catalog and storage interfaces. `@dictos/ai-sdk` reads a bundled snapshot, fetches and validates models.dev data, and injects a storage port implemented by `@dictos/fs-storage`. Its fixed supported-Provider registry filters both catalog results and generation routes; catalog-supplied `npm`, `api`, headers, or URLs are never execution instructions.

```typescript
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
    qualifiedId: QualifiedModelId
  ): Promise<SelectedModel | ModelCatalogError | ValidationError>;
  refresh(): Promise<ModelCatalog | ModelCatalogError>;
}
```

`supportedProviders()` lists Dictos-supported catalog Providers whether or not they have credentials. `configuredModels()` joins eligible catalog entries with configured Provider IDs and sorts by Provider ID then Model ID. `requireEligibleModel()` parses and checks both parts, returning a `ValidationError` for unknown, deprecated, or ineligible Models with a refresh hint; it does not probe provider credentials. Add `ModelCatalogError` in core with a safe `operation` and `reason`. Network, parse, and filesystem errors are converted at their adapter boundaries; raw catalog payloads and untrusted provider messages are not attached as causes.

Remove `ProviderPresetCatalog`, `ModelDiscoveryPort`, `StaticProviderPresetCatalog`, and `OpenAiCompatibleModelDiscoveryAdapter` when their callers move to these contracts. This feature has no compatibility requirement for the old provider commands or test-only Provider Connection file format.

### Provider Connection and Selected Model Services

`FsProviderConnectionRepository` keys records by Provider ID and refuses duplicate creation under its write lock. `ProviderConnectionService` checks the Provider ID against `supportedProviders()` and maps duplicate or missing records to handled error values. The repository is the only component that reads API keys from disk. `ModelSelectionService` validates both eligibility and a configured Provider Connection before persisting or resolving a choice; it never falls back to the first Model.

```typescript
interface ProviderConnectionRepository {
  create(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | ValidationError | StorageError>;
  findByProviderId(
    providerId: ProviderId
  ): Promise<ProviderConnectionWithCredential | StorageError | null>;
  findAll(): Promise<ProviderConnection[] | StorageError>;
  replaceKey(input: {
    providerId: ProviderId;
    apiKey: string;
  }): Promise<ProviderConnection | StorageError | null>;
  delete(
    providerId: ProviderId
  ): Promise<ProviderConnection | StorageError | null>;
}

interface LocalStateRepository {
  getLocalState(): Promise<LocalState | StorageError>;
  resetLocalState(): Promise<LocalState | StorageError>;
  setSelectedModel(
    value: SelectedModel | null
  ): Promise<LocalState | StorageError>;
}

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
    providerId: ProviderId
  ): Promise<ProviderConnection | NotFoundError | StorageError>;
}

class ModelSelectionService {
  select(
    qualifiedId: QualifiedModelId
  ): Promise<
    | SelectedModel
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
  >;
  current(): Promise<
    SelectedModel | null | ValidationError | ModelCatalogError | StorageError
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

`current()` returns `null` when nothing was chosen. A stored choice no longer in the catalog, no longer eligible, or missing its Provider Connection returns an actionable Error; it is never replaced automatically. `resolve()` checks an explicit override without altering the stored choice; without an override it uses the selected choice or returns a handled "select a Model" error. `disconnect()` clears a matching Selected Model as described above. Secret-bearing results never cross a CLI list or Model selection response.

### Description Generation Port

Keep the existing `DescriptionGenerationPort.generate()` request/result contract and `DescriptionGenerationRepository.commitProposal()` transaction boundary. Change the public service input from a generated connection ID plus a bare Model ID to a validated pair. The service rechecks catalog eligibility and retrieves the credential by Provider ID before calling the adapter; an unconfigured Provider or stale Model fails before the provider request. No AI SDK type enters core.

```typescript
class DescriptionGenerationService {
  createProposal(input: {
    sourceDescriptionId: string;
    instructionId: string;
    model: SelectedModel;
    targetTypes: DescriptionType[];
  }): Promise<
    | DescriptionGenerationProposal
    | ValidationError
    | NotFoundError
    | ModelCatalogError
    | StorageError
    | DbError
    | DescriptionGenerationError
    | InvalidGenerationResponseError
  >;
}
```

The Dictos-owned adapter map uses native `@ai-sdk/openai` for `openai`, native `@ai-sdk/google` for `google`, and the existing OpenAI-compatible adapter with fixed, reviewed base URLs for `openrouter`, `deepseek`, and `groq`. The SDK receives only the unqualified `modelId`; IDs containing `/` remain intact. Add `@ai-sdk/openai` and `@ai-sdk/google` at provider-API-3-compatible versions alongside the existing `ai` 6 and `@ai-sdk/openai-compatible` 2; do not upgrade the entire AI SDK as part of this feature. Keep one non-streaming `generateText()` invocation, the existing maximum two SDK retries for retryable failures, sanitization, `Output.object` decoding, the adapter's proposal shape checks, and core's Description Type, Sense, and duplicate-candidate validation.

| Provider ID  | Adapter                     | Endpoint source                  |
| ------------ | --------------------------- | -------------------------------- |
| `openai`     | `@ai-sdk/openai`            | SDK default OpenAI API endpoint  |
| `google`     | `@ai-sdk/google`            | SDK default Gemini API endpoint  |
| `openrouter` | `@ai-sdk/openai-compatible` | `https://openrouter.ai/api/v1`   |
| `deepseek`   | `@ai-sdk/openai-compatible` | `https://api.deepseek.com/v1`    |
| `groq`       | `@ai-sdk/openai-compatible` | `https://api.groq.com/openai/v1` |

These endpoint choices are maintained with the adapter map, not read from the Model Catalog. A new Provider requires an explicit reviewed route and boundary tests.

Google's structured-output API may reject the existing schema's `duplicateCandidateSenseId` union (`string | null`). Use the Google adapter's `structuredOutputs: false` setting for this proposal request while retaining `Output.object`, its schema-based decoding, and the same local `parseProposal` and core validation. Verify that behavior with an injected-fetch request/response test against the pinned SDK 6-compatible Google adapter before accepting the route; if it does not preserve the required `null` semantics, revise the provider-facing schema and this plan rather than weakening validation. Catalog `structured_output` metadata does not guarantee the Dictos proposal shape. Native OpenAI's request mode must likewise pass an adapter-boundary test instead of inheriting the compatible provider's `json_object` assumptions.

### Command Client Contract and Composition

Keep `dictos auth` for Dictos account login. Replace the old preset, connection-ID, and live-discovery commands with the following CLI surface:

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

`provider connect` and `reconnect` use the existing hidden `TerminalPrompt.readSecret()` boundary; neither accepts an API key as a flag. A missing Provider ID is a usage error, not an interactive picker. Reject an existing connection on `connect` and an absent connection on `reconnect` before prompting. `provider list` reports locally configured credentials, not validated access; `provider available` lists supported catalog IDs without credentials. `provider disconnect` requires `--yes` in scripts. A successful `models --refresh` lists from the new catalog; refresh failure exits with the handled-failure code and preserves the old cache. Default `models` output is sorted `provider/model` IDs on stdout; `--verbose` adds only validated name, status, and known input/output cost fields, using `-` when a cost is unknown. Report the catalog source and retrieval date on stderr so cached data is not mistaken for live account discovery; failures go there too, never into the ID stream. `model current` reports the saved qualified ID or an explicit unselected state. The generated Sense/Description ID output and duplicate-confirmation behavior stay as they are today. Expected model/catalog/storage failures use the existing expected-failure exit code; invalid syntax or missing required options use the usage-error code.

```typescript
type CliProviderDependencies = {
  providerConnectionService: ProviderConnectionService;
  modelCatalogService: ModelCatalogService;
  modelSelectionService: ModelSelectionService;
  logger: Logger;
};

interface CliContext {
  getProviderDependencies(): Promise<
    CliProviderDependencies | CliDependencyError
  >;
  getDependencies(): Promise<
    CliDependencies | CliDependencyError | DatabaseInUseError
  >;
}
```

Add `getProviderDependencies()` to the existing `CliContext` alongside its output and terminal-prompt methods. Build and cache one provider-only dependency graph per CLI invocation (data directory, logger, catalog, filesystem repositories). Let the existing full dependency factory extend it only for Dictionary/auth/sync commands that need Turso. Provider, `models`, and `model` handlers use `getProviderDependencies()` instead of `getDependenciesOrExit()`; generation obtains the full graph but resolves the qualified Model before `createProposal()`. This prevents provider-only commands from opening or migrating `dictos.db` when the TUI holds its lock. No new Dictos central-server endpoint or database migration is introduced.

## 4. Verification and Documentation

- Test Model ID parsing at the first slash, eligibility filtering (text input/output, deprecated, unsupported protocol), sorted lists, missing/removed Models, missing Provider Connections, no automatic fallback, and explicit override without changing the Selected Model.
- Exercise `FsProviderConnectionRepository` and `FsLocalStateRepository` through real temporary directories. Verify owner-only credential permissions, API-key redaction, preservation of an existing device-only `local-state.json`, atomic replacement, concurrent updates, deletion/selection failures, corrupt files, and no credential loss from a failed write.
- Test bundled-first offline startup, valid-cache precedence, corrupted-cache fallback with a visible warning, a newly listed Model after refresh, safe rendering of hostile catalog names, and a failed refresh that returns an Error without discarding the prior cache. Simulate only the external models.dev HTTP boundary; use a deterministic, reviewed catalog fixture.
- Test OpenAI, Google, and each retained OpenAI-compatible route with injected provider HTTP responses. Assert provider-specific request shape, nullable duplicate-candidate handling, no partial Dictionary data after invalid output, bounded retries, and credentials absent from errors and structured logs. Use a real temporary Turso database for proposal commit/rollback tests rather than mocking local persistence.
- Exercise CLI commands through the public program with a real local data directory. Hold the Dictionary database open and confirm `provider`, `models`, and `model` still work; verify stdout, stderr, exit codes, safe output, missing selection, key replacement, disconnection, duplicate acceptance, and no unwanted DB initialization. A live Gemini request is opt-in/manual and never required by CI.
- Run affected package tests, `bun run typecheck`, and Prettier checks. During implementation update `docs/system-overview.md` and the living Description Generation domain/contracts/data-model files to replace their old preset, custom endpoint, live-discovery, and per-command-only Model statements; keep the current-reality docs unchanged until code matches the new contracts.
