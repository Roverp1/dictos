# Data Model: Description Generation

**Parent Module**: [domain.md](./domain.md)

## Dictionary Records

Senses and typed Descriptions are synced Dictionary records documented in the [Dictionary Management data model](../dictionary-management/data-model.md). Saved-Description generation reads them as context; unsaved generation uses supplied text without opening the Dictionary. Accepted proposals and reviewed screen saves write records only through their atomic commit boundaries.

## Instructions

Instructions are synced Dictionary records.

| Field        | Type             | Rules                                     |
| ------------ | ---------------- | ----------------------------------------- |
| `id`         | `string`         | UUIDv7 identity                           |
| `name`       | `string \| null` | Optional; supplied values cannot be empty |
| `text`       | `string`         | Required and non-empty                    |
| `createdAt`  | `Date`           | Creation time                             |
| `modifiedAt` | `Date`           | Last modification time                    |

The `instructions` table stores nullable `name`, required `text`, and lifecycle timestamps. Instruction names are not unique and do not identify an Instruction.

## Provider Connections

Provider Connections are device-local and stored at `<dataDir>/providers.json`, not in the synced Dictionary database. There is at most one credential per supported Provider ID on a device.

```typescript
interface ProviderConnection {
  providerId: string;
}

interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

interface ProviderConnectionFile {
  version: 1;
  connections: Record<string, { apiKey: string }>;
}
```

The map key is the Provider ID; supported IDs are `deepseek`, `google`, `groq`, `openai`, and `openrouter`. The filesystem adapter validates the version and stored shape, serializes updates, writes through a uniquely named same-directory temporary file, removes temporary files after failed writes, and creates the file with owner-only mode `0o600`. Lists and mutation results use the safe `ProviderConnection` shape containing only `providerId`; targeted internal reads for Description Generation and connection management use `ProviderConnectionWithCredential`. Credentials are not included in normal output.

## Default Model and Selected Model

The Default Model is an optional qualified `provider/model` ID in device-local configuration. It initializes new work and is not a saved runtime selection. File scopes and inheritance are defined in the [configuration reference](../../configuration.md). There is no built-in Default Model or automatic catalog fallback.

Core receives the Selected Model as an explicit pair:

```typescript
interface SelectedModel {
  providerId: string;
  modelId: string;
}
```

The pair is represented externally as `provider/model`; Model IDs may contain further slashes. A CLI `--model` takes precedence over the configured default when initializing the invocation's Selected Model. The Overlay initializes from its startup snapshot and keeps its picker choice in memory for that opening. Neither choice changes configuration, the snapshot's Default Model, or any local-state file. Disconnecting a Provider removes only its credential.

`<dataDir>/local-state.json` holds only device identity through `LocalState = { deviceId: string }`; get/reset operations are described in the [Sync contracts](../sync/contracts.md). Model choice does not read or update this identity.

### Configuration Snapshot

`@dictos/config` infers the immutable snapshot from shared leaf schemas. Its version-1 transport contains `client`, effective `settings`, and value `origins`:

- `settings.defaultModel` is a qualified ID or `null`.
- `settings.logLevel` is the resolved CLI logging threshold.
- `settings.ocrLanguages` is `null` for CLI snapshots and a nonempty ordered list for Overlay snapshots.
- Each applicable setting has an origin with `kind` (`default`, `global`, `cli`, `overlay`, or `environment`), nullable source label, and original key path. Default origins also cover the absence of a Default Model.

An Overlay opening carries one validated snapshot to its CLI children through internal `DICTOS_OVERLAY_CONFIG_SNAPSHOT` transport. The snapshot contains no runtime Selected Model, device identity, authentication session, credentials, cache, or draft state. It is not persisted. The configuration module owns file documents, defaults, editor schemas, and resolution rules; core generation takes only domain inputs.

## Overlay-Local State

`@dictos/fs-storage` owns `<dataDir>/overlay-capture/state.json`:

```typescript
interface OverlayCaptureLocalState {
  version: 1;
  instructionText: string;
  selectedTypes: DescriptionType[];
}
```

`version: 1` identifies the file format, not the application version. An absent file returns empty Instruction text and `["definition"]`. Empty text clears the remembered directive. The store accepts only known Description Types; an empty selection is allowed. Malformed state returns `StorageError` without replacing the file, including during `replace()`.

The file holds a complete snapshot. `FsOverlayCaptureStateRepository` queues writes within one repository instance and atomically renames a unique owner-only (`0o600`) temporary file. Across processes, the last completed replacement wins; no persistent lock directory is used. The overlay debounces Instruction text and Type choices and flushes them before normal exit, including Cancel. This state is device-local and never synced. It contains no Selected Model, credentials, Entry text, captured Description, Sense suggestions, generated drafts, screenshots, or undo history. Choosing or editing copied Instruction text never writes a database Instruction.

## Model Catalog

`@dictos/ai-sdk` bundles a filtered models.dev snapshot for offline use. A validated cache at `<dataDir>/model-catalog.json` takes precedence; an absent or invalid cache falls back to the bundled snapshot. Normal catalog reads do not fetch. Explicit refresh validates and atomically replaces the cache; failure leaves the previous cache intact.

```typescript
interface CatalogProvider {
  id: string;
  name: string;
}

interface CatalogModel {
  providerId: string;
  modelId: string;
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

interface ModelCatalogCacheFile extends Omit<ModelCatalog, "source"> {
  version: 2;
}
```

`source` identifies the active catalog in memory; the cache file stores `version`, `fetchedAt`, `providers`, and `models`, but not `source`. `fetchedAt` is the snapshot retrieval date or the refresh timestamp, not proof of live Provider access. The `textGeneration: true` marker is derived from upstream data only after checking text input, text-only output, a non-deprecated status, a generation signal (`temperature`, `tool_call`, or `structured_output`), and no model-specific protocol override. The bundled snapshot and refresh use the same predicate. Text modalities alone are insufficient because models.dev includes embedding-only Models. Version 1 caches have no such marker and fall back to the bundled snapshot with a warning; an explicit successful refresh replaces them with version 2. Only eligible Models from configured Providers are listed for selection. Catalog metadata does not prove account access or guarantee Description Generation will succeed.

Provider Connections, configuration, runtime Selected Models, and the Model Catalog add no synced database table, Drizzle schema, or Sync record.

## Ephemeral Saved-Description Proposals

Generation proposals live only during a Command Client invocation and are never persisted.

```typescript
interface DescriptionGenerationProposal {
  entryId: string;
  sourceDescriptionId: string;
  expectedSourceSenseId: string | null;
  target:
    | { kind: "existing"; senseId: string }
    | {
        kind: "new";
        senseName: string;
        duplicateCandidateSenseId: string | null;
      };
  descriptions: { type: DescriptionType; text: string }[];
}
```

The proposal contains no API key, provider request or response, Model metadata, usage data, or generated row IDs. `expectedSourceSenseId` lets commit reject a proposal whose source Description changed while generation was running.

## Unsaved Input and Preview DTOs

Core owns the text inputs and outputs for screen generation:

```typescript
interface ScreenEntryText {
  entryText: string;
  descriptionText: string | null;
  instructionText: string;
}
interface ScreenDescriptionInput {
  type: DescriptionType;
  text: string;
}
interface SenseCandidate {
  name: string;
  definition: string;
}
interface GenerationDraft {
  senseName: string;
  descriptions: { type: DescriptionType; text: string }[];
}
```

Blank captured Description text becomes `null` for generation; blank inline Instruction text is valid. Suggestions contain zero to 20 candidates with nonblank names and previews. Names are distinct after trimming and case normalization; the AI SDK adapter limits previews to 240 characters. `definition` is preview text, not a persisted Description Type assignment. Drafts contain a nonblank Sense name and typed Descriptions without row IDs or a persisted proposal ID. These DTOs and session history stay in memory until reviewed text is explicitly saved.

## Overlay Session Drafts

The overlay owns Description cards separately from core DTOs:

```typescript
interface TypedDescriptionDraft {
  key: string;
  type: DescriptionType;
  text: string;
  edited: boolean;
}
```

`key` identifies a card through Sense changes and generated output. `edited: true` marks manually entered or corrected text, which suggested Sense selection retains. Empty slots remain available for generation; output fills them before adding cards and preserves relative order within a Type. Explicit Generate clears every slot of checked Types and resets its edited flag; unchecked cards remain intact. The right-column Type order is `definition`, `translation`, `example`, then `misc`.

History actions hold before/after text snapshots. Generation actions also track an immutable input fingerprint, the request revision, cached output, whether output is in the after-snapshot, and whether it was applied to the live draft. The fingerprint covers pending text, nonempty Descriptions, checked Types, and a Model revision. Undo captures corrections to an applied result while retaining unused cached output for redo. A cached or pending result applies only to matching inputs; undo/redo cannot rebind it to edited text. Changing the Selected Model invalidates pending generation and suggestions. Empty added cards do not change generation context. OCR selections keep their own source-word snapshots so crop replies cannot change previous highlight geometry or an in-progress drag. None of this session state is written to the local preferences file or Dictionary.

Reviewed saves use the current Entry, optional captured Description, and chosen typed text. Existing Dictionary tables hold the resulting records; no generation table or migration is added. The save result contains `entry`, nullable `sense` and `capturedDescription`, and typed `descriptions`. See the [Dictionary Management data model](../dictionary-management/data-model.md) for record identities and grouping.
