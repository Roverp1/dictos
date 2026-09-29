# Data Model: Description Generation

**Parent Module**: [domain.md](./domain.md)

## Dictionary Records

Senses and typed Descriptions are synced Dictionary records documented in the [Dictionary Management data model](../dictionary-management/data-model.md). Description Generation reads those records as context and writes them only through the atomic commit boundary.

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

## Selected Model

The device-local `<dataDir>/local-state.json` stores the Selected Model alongside the existing device identity:

```typescript
interface SelectedModel {
  providerId: string;
  modelId: string;
}

interface LocalState {
  deviceId: string;
  selectedModel: SelectedModel | null;
}
```

The selected pair is represented externally as `provider/model`; Model IDs may contain further slashes. A missing state file initializes a new `deviceId` with `selectedModel: null`. An existing file with a valid `deviceId` but no `selectedModel` is treated as unselected. Selection updates preserve `deviceId`; only an explicit local-state reset replaces it and clears the selection. No Model is chosen automatically. A per-command Model override does not change the saved choice.

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

No synced database table, Drizzle schema, or Sync record changes for Provider Connections, the Selected Model, or the Model Catalog.

## Ephemeral Proposals

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
