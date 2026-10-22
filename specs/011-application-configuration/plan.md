# Technical Plan: Application Configuration

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

Create `@dictos/config` as a portable module for setting definitions, validation, defaults, scope rules, resolution, and provenance. Use Zod 4 schemas with typed metadata to infer TypeScript types and generate editor schemas. Keep file settings optional during validation and apply defaults after combining loaded contributions. This gives each setting one definition and prevents an empty client file's default from replacing an explicit global value.

Put native discovery, TOML parsing, and create-if-missing initialization in `@dictos/fs-storage/configuration`. Use `smol-toml` so the adapter keeps its native JavaScript filesystem model. The adapter supplies parsed values to the portable resolver. Application wiring decodes environment variables and passes them as explicit inputs. Do not add a generic writable-source interface for files, environment variables, or command arguments. Only the filesystem adapter creates starter files; existing configuration is never edited through these interfaces.

Resolve shared → CLI for direct CLI use and shared → CLI → Overlay once when an Overlay opens. Pass the snapshot to its subprocesses through a process-local environment variable so file edits cannot change settings during a review. Pass the current Selected Model in each generation request. Existing generation modules check eligibility and Provider Connections, so remove the stateful `ModelSelectionService` without adding another Model-selection abstraction. See [ADR 0013](../../docs/adr/0013-keep-configuration-portable-and-snapshot-workflows.md).

### Package ownership and dependencies

| Package | Responsibility and dependency changes |
| --- | --- |
| New `packages/config` | Runtime dependency on `zod` 4 (`^4.6.7` at planning time) and `@dictos/errore`. Portable runtime exports, inferred types, setting metadata, and generated JSON Schema assets. |
| `packages/fs-storage` | Add `@dictos/config` and `smol-toml` (`^1.9.1` at planning time). Export native configuration functions through a separate `./configuration` entry point. |
| `apps/cli` | Add a direct `@dictos/config` dependency. Wire startup, logger settings, bootstrap output, snapshot decoding, and explicit Model inputs. |
| `apps/overlay` | Add `@dictos/config` and `@dictos/errore` for launch adapters that return Error values. Validate CLI bootstrap output and native OCR startup records. QML receives the snapshot and makes runtime Model choices. |
| `packages/core` | Remove persisted selection contracts and wiring. Keep existing generation inputs, Model parsing, eligibility checks, and Provider validation. No configuration dependency. |

Keep native code and schema-generation scripts outside the portable runtime entry point. Typecheck `packages/config` against ES libraries without ambient platform globals, and give it a separate Bun test configuration. Retain the maintained packages' existing test runners and runtime assumptions. Generated-schema tests may use `ajv` 8 and `ajv-draft-04` as development dependencies; neither belongs in runtime exports.

The file adapter iterates a finite load-chain table supplied by the portable module. It does not branch on individual setting names. New options are ordinary schema/metadata changes; there is no runtime plugin registry.

## 2. Data Model & State Changes

### Configuration documents

These types describe the file contracts. Infer implementation types from composed schemas instead of maintaining parallel handwritten definitions.

```typescript
type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

type GlobalConfigurationDocument = {
  generation?: { default_model?: string };
  logging?: { level?: LogLevel };
};

type CliConfigurationDocument = {
  overrides?: GlobalConfigurationDocument;
};

type OverlayConfigurationDocument = {
  overrides?: { generation?: { default_model?: string } };
  ocr?: { languages?: string[] };
};
```

Use strict objects at every level, including empty parent tables. Unknown keys and prohibited overrides must return errors, not be stripped. Decoding must not coerce values, expand variables, or insert defaults. Tables and leaves may be omitted, but present values must be valid. Preserve language order; an environment override replaces the entire list.

Default Model settings accept the structural form `provider/model`, including further slashes in the Model part. Reject blank parts and surrounding whitespace. Do not restrict the schema to the bundled catalog or currently connected Providers. Core's `parseQualifiedModelId` remains the authority when converting the chosen value into a domain input, and generation checks eligibility and credentials when used.

OCR languages are a nonempty list of nonblank Tesseract identifiers. Each identifier is one language, not a plus-separated expression; support ordinary names such as `eng`, `pol`, and `script/Latin`. Reject whitespace, plus signs inside an array element, and empty path segments. The native adapter joins validated identifiers with `+`. The effective defaults are no Model, logging level `info`, and Overlay languages `["eng"]`.

### Effective configuration and workflow snapshot

Expose flat effective values so consumers need not understand file tables or `overrides` sections. Infer this view and its snapshot validator from the same leaf definitions. `version` is an internal transport version, not the application version or a required TOML setting.

```typescript
type ConfigurationClient = "cli" | "overlay";
type ConfigurationScope = "global" | "cli" | "overlay";
type SettingId = "defaultModel" | "logLevel" | "ocrLanguages";

type ValueOrigin = {
  kind: "default" | ConfigurationScope | "environment";
  source: string | null;
  keyPath: readonly string[];
};

type ConfigurationSnapshot = {
  version: 1;
  client: ConfigurationClient;
  settings: {
    defaultModel: string | null;
    logLevel: LogLevel;
    ocrLanguages: readonly string[] | null;
  };
  origins: Readonly<Partial<Record<SettingId, ValueOrigin>>>;
};
```

CLI snapshots require `ocrLanguages: null`; Overlay snapshots require a nonempty language list. Origins are present for every applicable setting, including an absent Model's built-in `null` value. A file origin carries its source label and original key path, such as `overrides.generation.default_model`. Environment origins identify `DICTOS_OCR_LANG`. Origin labels are plain data; the portable module does not interpret paths.

Snapshots are immutable. They contain no credentials, authentication session, device identity, data-directory override, saved drafts, or runtime Selected Model. A CLI `--model` or Overlay picker choice is an operation input and does not rewrite `settings.defaultModel`.

### Existing stores and core state

No Dictionary tables, Drizzle schema, migrations, or Sync records change.

- Reduce core `LocalState` to `{ deviceId: string }`. Remove `setSelectedModel` from `LocalStateRepository` and its filesystem implementation. `getLocalState` and explicit identity reset remain.
- Read existing local-state files using the valid `deviceId` and ignore legacy selection properties without rewriting the file. Invalid JSON or an invalid device identity still returns `StorageError`; it must not generate a replacement identity. Manual key cleanup remains sufficient.
- Remove the `ModelSelectionService` implementation, export, CLI dependency, and persistence-specific tests. Remove its constructor dependency from `ProviderConnectionService`; disconnect only removes the credential and never changes configuration.
- Remove the `model` command group, including `model select` and the old device-wide `model current` lookup. The Overlay receives its starting choice through bootstrap rather than another lookup command. No replacement inspection command is required for this feature.
- Keep Provider Connections, authentication sessions, Model Catalog cache, and Overlay-local Instruction/Type state in their existing stores. Do not add a Model field to Overlay-local state.
- Make only the mechanical adjustments needed in the retained `local-storage` adapter to match the reduced core port. This does not add browser configuration or browser verification. TUI callers that use only device identity retain that behavior.

## 3. Interface Contracts & Boundaries

### Portable configuration module

Use a finite set of leaf definitions with a schema, description, default, example, effective setting ID, and allowed scope paths. Reuse them to compose document schemas, the effective-value schema, metadata descriptions, and snapshot validation. A small internal definition helper may enforce metadata types; it is not a public configuration language.

```typescript
type ConfigurationDocument = {
  source: string;
  value: unknown;
};

type ConfigurationLiteral =
  | string
  | number
  | boolean
  | null
  | readonly ConfigurationLiteral[]
  | { readonly [key: string]: ConfigurationLiteral };

type ConfigurationSettingDescription = {
  id: SettingId;
  keyPath: readonly string[];
  description: string;
  defaultValue: ConfigurationLiteral;
  example: ConfigurationLiteral;
};

type ResolveConfigurationInput = {
  client: ConfigurationClient;
  documents: Readonly<
    Partial<Record<ConfigurationScope, ConfigurationDocument>>
  >;
  environment: { ocrLanguages: readonly string[] | null };
};

function configurationScopes(input: {
  client: ConfigurationClient;
}): readonly ConfigurationScope[];

function resolveConfiguration(
  input: ResolveConfigurationInput,
): ConfigurationSnapshot | ConfigurationError;

function validateConfigurationSnapshot(input: {
  value: unknown;
}): ConfigurationSnapshot | ConfigurationError;

function describeConfiguration(input: {
  scope: ConfigurationScope;
}): readonly ConfigurationSettingDescription[];
```

`configurationScopes` returns `["global", "cli"]` or `["global", "cli", "overlay"]`. Both file loading and resolution use this table. The resolver validates every contribution in that chain before selecting values, regardless of later overrides. It ignores scopes outside the chosen chain. It resolves each setting's last supplied value, then fills missing values from the definitions. This gives table inheritance and scalar/list replacement without a general-purpose object-merging framework.

`ConfigurationSettingDescription` supplies the allowed document key path, description, default or absence, and example as JSON-compatible values. A `null` default means no configured starting value; it is not rendered as TOML. The native template renderer uses these descriptions to create commented TOML. File-specific descriptions include the permitted `overrides` paths; adapters never invent a second option list.

The snapshot validator accepts only the complete version-1 shape, checks the client/value/origin invariants, and inserts no defaults. It does not reread configuration or probe a Provider. Missing, malformed, unsupported-version, or wrong-client snapshots are errors.

Implement `ConfigurationError` with `errore.createTaggedError` and a list of issues:

```typescript
type ConfigurationIssue = {
  kind: "initialize" | "read" | "parse" | "validate" | "snapshot";
  source: string;
  keyPath: readonly string[];
  line: number | null;
  column: number | null;
  message: string;
};
```

Use `safeParse` for expected schema failures. Wrap parser, JSON, and filesystem exceptions at their adapter seams and return Error values. Diagnostics show source, key, expected shape, and available location without dumping the input value, TOML text, environment payload, or raw parser error. Retain causes internally and sanitize them before structured logging.

### Native configuration adapter

```typescript
type NativeConfigurationPaths = {
  directory: string;
  schemaUris: Readonly<Record<ConfigurationScope, string>>;
};

function resolveNativeConfigurationPaths(input: {
  platform: string;
  homeDirectory: string;
  environment: Readonly<Record<string, string | undefined>>;
}): NativeConfigurationPaths | ConfigurationError;

function initializeAndLoadConfiguration(input: {
  client: ConfigurationClient;
  paths: NativeConfigurationPaths;
  ocrLanguageEnvironment: string | null;
}): Promise<ConfigurationSnapshot | ConfigurationError>;
```

These functions live under `packages/fs-storage/src/configuration/`. Keep path discovery separate from directory creation. Use the following configuration locations; the existing data-directory function is unchanged.

| Platform | Configuration directory |
| --- | --- |
| Linux and other XDG-style native environments | Absolute `XDG_CONFIG_HOME` plus `/dictos`, otherwise `<home>/.config/dictos`; ignore relative XDG values rather than resolving them against the working directory. |
| macOS | `<home>/Library/Preferences/dictos` |
| Windows | Absolute `APPDATA` plus `/dictos/config`, otherwise `<home>/AppData/Roaming/dictos/config` |

The adapter maps scopes to `config.toml`, `cli.toml`, and `overlay.toml`. Locate schema artifacts through the exported `@dictos/config/schemas/*.json` assets and turn their native locations into absolute file URIs for starter directives. Resolve those assets before creating files, so a missing build artifact produces an error instead of a broken starter reference.

For each required file:

1. Preserve an existing target, including an empty file or symlink. Reads may follow a symlink to a regular file; directories and unreadable targets return errors.
2. If missing, create the parent directory, render the starter from shared metadata, and write a uniquely named same-directory temporary file with exclusive creation and owner-only permissions.
3. Close the complete temporary file, then publish it with `fs.link(temporary, target)`. A normal rename is unsuitable because it can replace a file created by another process. Treat `EEXIST` as another creator winning and read that target.
4. Remove temporary files after success or failure. Return other publication failures; do not fall back to an overwrite or a persistent lock directory.
5. Read the resulting file with a 256 KiB per-file limit, decode UTF-8 strictly, and parse using `smol-toml`. Translate available `TomlError` locations into safe issue data.

`resolveConfiguration` validates the files; do not add a separate native validator. An invalid lower-priority file remains an error. Creation is per-file, not an all-files transaction. A failed startup may leave complete starter files already published, but must not roll back or overwrite another file.

Decode `DICTOS_OCR_LANG` only for Overlay startup. Unset or empty means no override, matching the current launcher convention. Otherwise split on `+`, preserve order, and validate the resulting list through the shared language schema. Do not reapply that environment variable in children that already have a resolved snapshot.

### Generated schemas and starter files

Generate self-contained Draft 4 JSON Schemas with Zod's JSON Schema exporter in input mode. Draft 4 covers these settings and works with Taplo and Tombi. File schemas use strict objects with optional tables and values; do not export the required effective snapshot as a file schema. Standard descriptions, examples, enums, and default metadata provide editor help. Omit the JSON Schema `default` annotation for an absent Default Model; `null` is not a valid default for a string setting.

Check generated assets into `packages/config/schemas/` so the existing checkout-based commands work after installation without a schema-generation step at application startup. Export `./schemas/*` as data assets. Add package scripts:

```bash
bun run --cwd packages/config generate:schemas
bun run --cwd packages/config check:schemas
```

Generation writes all three schemas deterministically. The check command regenerates in memory and fails on differences without changing files. Run that check as part of the package's test command so the root suite detects stale artifacts. Neither generation path is imported by portable runtime consumers.

The native adapter renders starter files at initialization. Include a valid schema directive, a scope-specific inheritance explanation, and commented tables and assignments. Use metadata defaults for logging and OCR examples; use the documented example when a setting has no default. Keep every setting assignment commented. Never render environment inputs, current effective values, credentials, or the legacy selection. Subsequent starts do not update existing templates or directives.

### CLI startup and explicit Model input

Extend the existing lazy context rather than initializing configuration at module import or introducing a throwing Commander startup hook:

```typescript
type ConfigurationLoader = () => Promise<
  ConfigurationSnapshot | ConfigurationError
>;

type CliConfigurationContext = {
  getConfiguration(): Promise<ConfigurationSnapshot | ConfigurationError>;
};

function resolveCommandModel(input: {
  override: string | null;
  configured: string | null;
}): SelectedModel | ValidationError;
```

Add `getConfiguration` to `CliContext`, cache its promise per invocation, and allow a loader to be supplied at composition. The default loader uses native CLI configuration unless an Overlay snapshot is present. Provider and Dictionary dependency creation first obtains the validated configuration; configuration errors propagate as their own type rather than becoming unexpected dependency failures. Pass `settings.logLevel` into Pino's existing logger setup.

Most actions already obtain one of those dependency graphs. State helpers that currently call filesystem storage directly must obtain configuration first without constructing the Provider or Dictionary graph. Configuration bootstrap has its own direct native load path. Help/version and parser usage failures do not call a loader, so they create no files.

`resolveCommandModel` selects the explicit operand when present, otherwise the configured Default Model. With neither, return a handled validation error explaining file configuration and `--model`. Convert the chosen ID with core's existing parser and pass the pair to the existing generation module. Do not add a replacement eligibility check in configuration or a new persistence operation. Core generation rechecks the actual Model and connection.

Remove `registerModelCommands`, its registration, selection dependency types, and obsolete `model current`/`model select` tests. Update generation fixtures to use a configured default or explicit operand rather than seeding persisted selection.

### Overlay bootstrap and snapshot transport

Add one bootstrap operation under the existing Overlay command group:

| Contract | Value |
| --- | --- |
| Command | `dictos overlay bootstrap --json` |
| Input | No stdin request |
| Success stdout | One newline-terminated `OverlayCliResponse<ConfigurationSnapshot>` with `client: "overlay"` |
| Work performed | Initialize the three-file chain, resolve configuration and supported environment inputs, return the snapshot |
| Excluded work | No Dictionary open, device-state initialization, credential read, Provider eligibility check, or network request |

Bootstrap always starts a new native Overlay load. It ignores any inherited snapshot so opening another Overlay reads the current files rather than adopting a parent opening's settings.

Add `apps/overlay/src/prepare-launch.ts` as a Bun process adapter. It runs bootstrap with the known CLI path, checks the child exit status and envelope, validates the returned snapshot through `@dictos/config`, and prints only compact snapshot JSON on success. For a valid configuration failure, print its actionable `error.message` on launcher stderr without replacing it with a generic launch failure, then return nonzero. For malformed outcomes, report a safe local launch error and return nonzero. Bound captured bootstrap output to 1 MiB and encoded snapshots to 16 KiB.

`run.sh` invokes that helper before starting the native OCR companion or capturing the screen. Capture its output in a standalone assignment, check success, then export it as `DICTOS_OVERLAY_CONFIG_SNAPSHOT`. Derive the native language argument by joining `snapshot.settings.ocrLanguages` with `+`. This process-local variable contains only configuration values and provenance and is inherited by Quickshell and all its CLI children; it is not a user preference or a global shell setting.

Every CLI child decodes that variable once through the shared snapshot validator and requires `client: "overlay"`. It then uses the snapshot directly, including the inherited CLI logging level, without discovering, creating, or rereading TOML files. A present but invalid snapshot fails; it never falls back to disk. Existing inherited data-location environment conventions still determine shared storage.

### Overlay request and QML changes

Extend the existing request types with one required explicit Model field:

```typescript
type SuggestRequest = {
  entryText: string;
  descriptionText: string | null;
  instructionText: string;
  model: string;
};

type GenerateRequest = SuggestRequest & {
  senseName: string | null;
  descriptions: ScreenDescriptionInput[];
  targetTypes: DescriptionType[];
};
```

The `model` value is a qualified ID. Missing or malformed IDs are invalid requests; valid but unavailable Models fail through the existing generation checks. These operations do not substitute a configured default for an omitted request Model. Save and state request bodies do not gain Model fields. Keep the single-line framing and 1 MiB request limit.

In `shell.qml`, read the prepared snapshot before enabling workspace startup and pass its `defaultModel` as an initial workspace value. In `CaptureWorkspace.qml`, initialize `selectedModel` from that value and remove the `model current` startup request. Choosing an item in the existing picker assigns `selectedModel` immediately; remove the `model-select` command, asynchronous selection branch, and its pending flags. Each suggestion and generation payload captures the current selection when the request is created. Model listing, Instruction listing, state helpers, and Save remain normal CLI children using the inherited snapshot.

Keep `onSelectedModelChanged` and the state helper's existing request revisions. They prevent late replies from updating work after a selection change and preserve existing editor text. The runtime selection is not part of the snapshot or Overlay-local state. QML tests can pass an initial Model directly without loading native configuration or changing existing draft-history interfaces.

English (`eng`) is the default OCR argument. Explicit file/environment languages replace it. After Tesseract initialization, check `GetLoadedLanguagesAsVector` against every requested identifier before publishing readiness; `Init` alone can accept a partially loaded combination. Missing requested data reports the missing language and stops OCR initialization. Do not retry with English. This is language-configuration validation, not a new OCR mode or engine.

### Native OCR startup results

Extend the helper's stdout readiness record to report safe startup failures as well as success. Emit one newline-terminated JSON record, bounded to 16 KiB:

```typescript
type OcrStartupFailure =
  | {
      code: "OCR_LANGUAGE_UNAVAILABLE";
      missingLanguages: readonly string[];
    }
  | { code: "OCR_INITIALIZATION_FAILED" | "OCR_STARTUP_FAILED" };

type OcrStartupRecord =
  | { ready: true; initMs: number }
  | { ready: false; error: OcrStartupFailure };
```

If `Init` succeeds but loads only some requested languages, report the missing requested identifiers before exiting nonzero. If `Init` fails before the loaded set can be checked, report `OCR_INITIALIZATION_FAILED`; the launcher already has the requested languages. Other helper startup failures use `OCR_STARTUP_FAILED`. Keep raw Tesseract stderr separate from the user-facing error protocol as diagnostic output.

Add a bounded decoder and renderer in `apps/overlay/src/ocr-startup.ts`. Validate the record and require every reported missing identifier to belong to the opening's validated language list. Render language names from that known list with local setup guidance. Never render arbitrary stderr or a helper-supplied message. For missing, malformed, or oversized records, produce a generic local startup error without copying the output to the terminal.

`run.sh` must read the record before deleting temporary output. Before starting Quickshell, require a valid success record, a live helper, and a ready socket. On a failure record, print the rendered diagnostic to launcher stderr, exit nonzero, and perform normal cleanup. A nonempty readiness file or socket alone does not prove startup succeeded. Keep this change within the startup handshake, without adding an Overlay logging system or changing OCR request/response bodies.

### Failure and output contracts

Add `CliExitCode.ConfigurationFailure = 5`. Preserve existing success, unexpected, usage, operation-failure, and database-in-use exit codes. Configuration errors from direct actions, bootstrap, state helpers, or Overlay children use exit 5. Human output includes safe source/key diagnostics on stderr. Machine-readable commands return exactly one newline-terminated failure envelope:

```typescript
type ConfigurationFailureResponse = {
  ok: false;
  error: {
    code: "CONFIGURATION_ERROR";
    message: string;
    issues: readonly ConfigurationIssue[];
  };
};
```

Extend the shared response error shape with an optional `issues` property. Configuration failures always include a nonempty issue list; existing error codes retain their current code/message shape. Use safe messages and issue data rather than raw input or exception text.

Add one formatter in `apps/cli/src/app/configuration-error.ts`:

```typescript
function configurationFailureResponse(input: {
  error: ConfigurationError;
}): ConfigurationFailureResponse;
```

Its `error.message` summarizes the first safe issue: file/input source, setting path if known, available location, and the reason or expected shape. Include the remaining issue count when needed and retain all safe issues in the array. For snapshot errors, identify the startup snapshot and offending field without printing the environment payload. Human stderr, JSON responses, and bootstrap failure reporting use the same summary. Consumers must be able to display `message` directly; `issues` provides supplemental detail.

Handle configuration errors explicitly in `commands/models.ts`, `commands/instruction.ts` JSON listing, `commands/overlay-state.ts`, Overlay operation/bootstrap responders, and shared dependency/output helpers. Each independent conversion must preserve exit 5 and the configuration failure envelope, including those outside the shared command-action helpers.

`CommandJob.qml` must preserve a valid failure response's message through its exit/envelope checks. `CaptureWorkspace.qml` displays that message in the existing Notification and preserves drafts. QML displays the message directly, without another issue-array formatter or any reliance on captured stderr. Verify that the actual Notification text includes the source/key/reason summary.

Malformed Overlay framing or request Model shape remains exit 2 with `INVALID_REQUEST`. A Model rejected by catalog/connection/generation checks remains an operation failure, with no automatic replacement. Add configuration-error handling to the shared output/dependency helpers so a usable error envelope is not replaced by a generic dependency message. Keep raw configuration, parser causes, and Provider data out of logs and normal output. Emit a process snapshot only through bootstrap's explicit success response, not through diagnostic output or logs.

No HTTP endpoint or server contract is added.

## 4. Verification

Follow [the project testing rules](../../docs/testing.md): pure resolution tests use logical inputs; filesystem and process behavior use real temporary infrastructure. All tests are colocated with the behavior they exercise.

| Area | Required evidence |
| --- | --- |
| Portable resolution | Shared → CLI and shared → CLI → Overlay inheritance; deleting an override; list replacement; provenance; invalid overridden lower-priority values; prohibited Overlay logging overrides; no Model and English defaults. |
| Editor schema agreement | Run representative valid/invalid document cases through runtime validation and an independent Draft 4 validator. Check generated artifacts for drift. Verify completion, hover descriptions, and diagnostics manually in one TOML editor using local artifacts. |
| Native adapter | Real files for first-run scope, fully commented starters, existing empty/custom/malformed files, unreadable paths, size/parse failures, and schema directives that resolve locally. Concurrent processes must preserve existing content and publish only complete files. |
| CLI | Real startup under isolated configuration/data homes; help/version create nothing; removed Model commands; explicit `--model`; configured default; legacy selection ignored; device identity preserved; global and CLI logging levels reflected in the real CLI log. Exercise configuration failures through Model listing, Instruction listing, state, bootstrap, and operation JSON branches; each must retain exit 5 and an actionable message. |
| Overlay workflow | Bootstrap creates all three files without opening Dictionary or credentials. Later file edits do not affect children using the snapshot. Invalid snapshots fail without a disk fallback. Two openings keep separate selections, and a new opening reads the edited configuration. |
| QML | Initial Model from bootstrap, local picker selection, explicit request Model payloads, manual Save with no usable Model, and preservation of existing text and late-reply/undo protections. A configuration failure's actual Notification contains its safe source/key/reason summary without requiring stderr or an issue-array renderer. |
| OCR | The real helper receives `eng` by default and a configured/overridden combination when supplied. Run the actual launcher with missing or partially loaded language data. Verify its stderr names the missing identifier before cleanup, it exits nonzero, and Quickshell does not start. Malformed startup output produces a safe local diagnostic without forwarding raw helper stderr. |

Fixtures must isolate both configuration and data locations so tests neither consume nor rewrite the developer's files. Use actual subprocesses for startup races and snapshot inheritance; do not mock filesystem calls or internal logging. Live paid Provider access is not required.

Implementation verification commands:

```bash
bun run --cwd packages/config check:schemas
bun run typecheck
bun run test
devenv --profile overlay shell -- bun run --cwd apps/overlay test:native
```

The root test command includes the maintained Overlay Bun/Qt checks, while native OCR verification remains separate. Adjust retained browser types for the core port change, but do not claim browser/WASM verification from these commands. Record graphical-session and editor checks separately from automated results.

## 5. Implementation Documentation

Add package documentation for the portable configuration interface and native adapter. Add `docs/configuration.md` as the reference for paths, file scopes, precedence, starter behavior, defaults, environment/command overrides, and local editor schemas. Keep CLI and Overlay setup workflows in their READMEs and link to that reference rather than maintaining separate option catalogs.

Update the System Overview and root README for the CLI-first alpha, new configuration module, and runtime Model selection. Update Description Generation and Sync documentation where they currently describe `selectedModel` persistence, selection-clearing on disconnect, or the old picker protocol. Preserve the accepted Default Model/Selected Model glossary definitions and existing credential/Dictionary contracts. Do not add migration documentation for the legacy selection.
