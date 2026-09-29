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

`ModelCatalogAdapter` reads a validated cache or falls back to its bundled models.dev snapshot (warning on a bad cache). Normal listing makes no network request. Explicit refresh fetches the fixed `https://models.dev/api.json` URL with time and size limits, filters to the five supported Providers and eligible text-generation Models, validates display fields, and replaces the cache only on success. The reviewed snapshot updater and runtime refresh use one upstream eligibility predicate: text input, text-only output, at least one generation signal (`temperature`, `tool_call`, or `structured_output`), a supported status, and no model-specific provider override. `FsModelCatalogStore` atomically reads/writes a validated version 2 cache at `<dataDir>/model-catalog.json`; version 1 lacks text-generation proof and falls back to the bundled snapshot without deleting the file. Failed refresh leaves the prior cache intact.

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

## Generation Boundary

`DescriptionGenerationPort.generate(request)` takes a credential-bearing connection, unqualified `modelId`, Instruction text, Entry and source Description context, requested Description Types, and either an existing Sense or the Entry's existing Senses. It returns `GeneratedProposal | DescriptionGenerationError | InvalidGenerationResponseError`; the proposal contains typed Descriptions and either an existing Sense ID or a new Sense name with a nullable duplicate candidate ID. No AI SDK type enters core.

`DescriptionGenerationService.createProposal({ sourceDescriptionId, instructionId, model: SelectedModel, targetTypes })` loads context, rechecks Model eligibility and the Provider Connection, invokes the port, and validates type coverage, content, Sense target, and duplicate-candidate ownership without writing. Its result is `DescriptionGenerationProposal | ValidationError | NotFoundError | ModelCatalogError | StorageError | DbError | DescriptionGenerationError | InvalidGenerationResponseError`. `commitProposal(proposal)` returns `DescriptionGenerationResult | DbError | GenerationConflictError` through `DescriptionGenerationRepository.commitProposal`.

`@dictos/ai-sdk` routes only `openai` to native `@ai-sdk/openai`, `google` to native `@ai-sdk/google`, and `openrouter`, `deepseek`, `groq` to `@ai-sdk/openai-compatible` at fixed Dictos-owned URLs. Catalog URLs, headers, and package names do not control requests. The adapter makes one non-streaming `generateText()` call with `Output.object` and local proposal checks; the SDK may retry retryable failures at most twice. Google disables provider structured outputs for this request; compatible routes disable structured outputs on their provider. Provider errors and invalid output become distinct safe Error values. The CLI installs the AI SDK warning bridge, which logs warning type/feature rather than raw warning text; provider request logs use status/retry metadata and sanitized causes, not API keys, headers, or raw responses.

## Command Client

`CliContext.getProviderDependencies()` lazily caches a provider-only graph (local storage, catalog, selection, logger); `getDependencies()` extends it with the Dictionary database, generation adapter, and other services. Provider, catalog, and selection commands do not open `dictos.db`. Generation uses the full graph; the central server is not on the generation path.

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
