# @dictos/config

Portable configuration definitions, validation, resolution, and provenance for the Command Client and Overlay. See the [configuration reference](../../docs/configuration.md) for user-facing paths, settings, precedence, and editor setup.

## Runtime boundary

The runtime entry point uses Zod 4 and `@dictos/errore`. It accepts parsed logical documents and explicit environment inputs. It has no filesystem, process-environment, TOML, database, or UI access. Native discovery, parsing, and starter creation belong to [`@dictos/fs-storage/configuration`](../fs-storage/README.md#configuration-entry-point).

Leaf definitions in `src/definitions.ts` supply constraints, descriptions, defaults, examples, effective IDs, and allowed scope paths. The document schemas, inferred setting/document types, snapshot schema, metadata descriptions, and generated editor schemas reuse those definitions. Build-time schema generation is outside the portable runtime import graph. Runtime TypeScript checking uses ES libraries without ambient platform globals; this boundary does not establish browser client support or browser/WASM verification.

## Public interface

Import functions and types from `@dictos/config`:

| Export                                                   | Contract                                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configurationScopes({client})`                          | Returns `global → cli` for `cli`, or `global → cli → overlay` for `overlay`.                                                                                                              |
| `resolveConfiguration({client, documents, environment})` | Validates every contribution in the chosen chain, resolves effective values and origins, and returns `ConfigurationSnapshot \| ConfigurationError`. Scopes outside the chain are ignored. |
| `validateConfigurationSnapshot({value})`                 | Validates a complete version-1 snapshot without inserting defaults or loading external state. Returns `ConfigurationSnapshot \| ConfigurationError`.                                      |
| `describeConfiguration({scope})`                         | Returns allowed setting paths, descriptions, defaults, and examples for starter rendering.                                                                                                |

`documents` maps scopes to `{source, value}`. Source labels appear in diagnostics; the package does not interpret them as paths. `environment` is `{ocrLanguages: readonly string[] | null}`; native code decodes the supported environment variable before passing it here. Command-specific Model choices remain operation inputs and are not resolver settings.

```ts
import { resolveConfiguration } from "@dictos/config";

export function resolveExample() {
  const configuration = resolveConfiguration({
    client: "cli",
    documents: {
      global: {
        source: "example shared settings",
        value: { logging: { level: "warn" } },
      },
      cli: { source: "example CLI settings", value: {} },
    },
    environment: { ocrLanguages: null },
  });
  if (configuration instanceof Error) return configuration;
  return configuration.settings;
}
```

### File documents and scopes

`globalConfigurationSchema`, `cliConfigurationSchema`, and `overlayConfigurationSchema` are exported individually and through `configurationSchemas`, keyed by scope. Use their `safeParse` API for direct schema inspection, or the resolver for Error-value diagnostics and effective settings.

File tables and values are optional. Strict objects reject unknown keys at every depth, including prohibited overrides; validation neither coerces input nor inserts defaults. The global scope permits shared settings. CLI permits shared overrides under `overrides`. Overlay permits its Default Model override under `overrides.generation` and its own `ocr` settings, but rejects a logging override. A valid CLI logging override is inherited by Overlay children.

The resolver validates lower-priority documents even when a later value would replace them. Omitted leaves inherit by setting path; supplied scalars and lists replace earlier values. Defaults apply only after contributions are combined. Shape validation does not consult the Model Catalog, Provider Connections, or installed OCR data. Generation checks Model eligibility and access when using the Selected Model.

### Snapshots and metadata

`ConfigurationSnapshot` is inferred from `configurationSnapshotSchema`. It contains:

- `version: 1`, an internal transport version, and `client: "cli" | "overlay"`.
- Required `settings`: `defaultModel` (qualified ID or `null`), `logLevel`, and `ocrLanguages` (nonempty ordered list for Overlay, `null` for CLI).
- `origins` for every applicable setting, including the absent Default Model. CLI has no OCR origin.

The snapshot, settings, individual origin records, key paths, and language lists are readonly and frozen by validation. Consumers treat the complete snapshot as immutable. `ValueOrigin` contains `kind`, `source`, and `keyPath`. Built-in origins use `kind: "default"`, a null source, and an empty path. File origins retain the contributing scope, source label, and original document path. Environment origins identify `DICTOS_OCR_LANG`.

`configurationSnapshotSchema` and `valueOriginSchema` are exported. Snapshot validation requires all fields and consistent client/value/origin combinations. It rejects unknown fields, unsupported versions, and missing or inconsistent origins. It does not fill missing fields. Native child wiring additionally requires an Overlay snapshot when receiving an inherited Overlay context.

A snapshot contains no runtime Selected Model, credentials, authentication session, device identity, data-directory override, or draft state. A picker choice or command `--model` leaves `settings.defaultModel` unchanged.

Other exported types are `GlobalConfigurationDocument`, `CliConfigurationDocument`, `OverlayConfigurationDocument`, `LogLevel`, `ConfigurationClient`, `ConfigurationScope`, `SettingId`, `ConfigurationLiteral`, `ConfigurationSettingDescription`, `ConfigurationDocument`, `ResolveConfigurationInput`, and `ConfigurationIssue`.

`ConfigurationError` is a tagged Error value with a nonempty `issues` list. Each issue has `kind` (`initialize`, `read`, `parse`, `validate`, or `snapshot`), `source`, `keyPath`, nullable `line`/`column`, and a safe `message`. Consumers format these issues for their output boundary rather than exposing raw parser causes or input payloads.

## Editor schemas and checks

Checked-in, self-contained Draft 4 JSON Schemas describe optional file contributions, not the required effective snapshot:

- `@dictos/config/schemas/config.schema.json`
- `@dictos/config/schemas/cli.schema.json`
- `@dictos/config/schemas/overlay.schema.json`

The package exports these as data assets through `./schemas/*`. Schemas include descriptions, examples, allowed values, and applicable default annotations. The absent Default Model has no JSON Schema `default: null`, since null is not a valid file value.

From the repository root:

```bash
bun run --cwd packages/config generate:schemas
bun run --cwd packages/config check:schemas
bun run --cwd packages/config typecheck
bun run --cwd packages/config test
```

Generation uses Zod's input-mode JSON Schema exporter and writes deterministic artifacts. `check:schemas` compares generated content without writing files; the package test command includes this drift check. Applications use the checked-in assets and do not generate or download schemas at startup.
