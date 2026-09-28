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

Provider Connections are device-local and stored at `<dataDir>/providers.json`, not in the Dictionary database.

```typescript
interface ProviderConnection {
  id: string;
  name: string;
  presetId: string | null;
  baseUrl: string;
}

interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

interface ProviderConnectionFile {
  connections: ProviderConnectionWithCredential[];
}
```

Connection IDs use random UUIDs. The filesystem adapter validates the stored JSON shape, writes through a uniquely named same-directory temporary file, removes temporary files after failed writes, and enforces final file mode `0o600`. Normal lists use the safe `ProviderConnection` shape; only targeted internal reads for Model discovery and Description Generation receive the credential-bearing shape.

Provider presets are static endpoint metadata. A Provider Connection stores the selected `presetId` and resolved `baseUrl`, while Models are discovered at runtime or supplied manually and are not stored as a default selection.

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
