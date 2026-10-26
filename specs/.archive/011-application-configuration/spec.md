# Specification: Application Configuration

**Status**: Implemented | **Created**: Oct 19, 2026 | **Archived**: Oct 26, 2026

The [configuration reference](../../../docs/configuration.md), client/package documentation, and Description Generation and Sync modules describe the delivered behavior. This file preserves the planning contract. The [implementation tasks](./tasks.md#absorption-and-manual-verification-2026-10-26) record reported manual checks and remaining interactive verification limits.

## 1. The Problem (Why are we doing this?)

The first Dictos alpha focuses on the Command Client and development Overlay. Their settings come from hardcoded values, environment variables, and device-local state. Users cannot define shared preferences once and choose client-specific behavior. Without a common contract, each client would maintain its own defaults and validation.

Model selection also conflates a starting preference with the Model used for current work. The Command Client saves one device-wide Selected Model, which the Overlay also reads and changes. Trying another Model in one Overlay can affect later commands or other Overlays. A temporary choice should not change the preference for unrelated work.

The configuration design must support future TUI, Web, and Mobile clients without requiring native file access or TOML handling. Editors should provide completion and documentation. Maintainers should define each setting once, rather than synchronize separate types, validators, defaults, and editor schemas.

## 2. The Solution (What are we building?)

Use hand-edited TOML configuration: one global file for shared behavior, with separate CLI and Overlay files. The CLI inherits shared settings. The Overlay inherits shared and CLI settings, then applies its permitted overrides. Users can configure a Default Model, CLI logging level, and Overlay OCR languages. Omitted settings inherit lower-priority values or built-in defaults.

A Default Model is the configured starting choice for new work. A Selected Model is the choice for the current command or open Overlay. Command-specific arguments and the Overlay picker can change the current choice without editing configuration. Remove `dictos model select`; users edit configuration files to change persistent preferences.

On first startup, Dictos creates missing configuration files with schema directives, descriptions, and commented examples. Settings remain commented until users choose to override them. Generated editor schemas provide setting-name and value completion, hover documentation, and validation in existing TOML editors. Invalid settings identify the relevant file and setting. Credentials, device identity, remembered Overlay inputs, and Dictionary content remain separate from configuration.

## 3. User Experience (How does it work?)

### Files and initial settings

The configuration directory contains `config.toml`, `cli.toml`, and `overlay.toml`. Direct CLI invocations load `config.toml` and `cli.toml`. The Overlay loads all three files in that order because it uses the CLI for its operations. Neither client searches the current working directory or reads unrelated client files.

| File and setting                          | Meaning                                                                          | Allowed client overrides |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| `config.toml`: `generation.default_model` | Optional qualified `provider/model` ID used to initialize new work               | CLI and Overlay          |
| `config.toml`: `logging.level`            | Minimum CLI logging level: `trace`, `debug`, `info`, `warn`, `error`, or `fatal` | CLI                      |
| `overlay.toml`: `ocr.languages`           | Nonempty list of Tesseract language identifiers                                  | Overlay-owned setting    |

In `cli.toml` and `overlay.toml`, shared-setting overrides go under `overrides`, using the same setting paths as the global file. Client-owned settings, such as `ocr.languages`, go outside that section. The Overlay's permitted overrides take priority over values inherited from the CLI. Scope validation applies to the file supplying a value: a CLI logging override is valid and inherited by Overlay subprocesses, while a logging override written in `overlay.toml` is an error.

`logging.level` controls the existing Command Client logger, including CLI-backed operations launched by the Overlay. Both use the level resolved from the global file and `cli.toml`. It does not configure QML warnings, launcher output, or native OCR diagnostics. The Overlay has no logging setting or override in this feature.

These examples show enabled values. Generated starter files leave setting entries commented out. A user can configure a shared Model and logging level:

```toml
#:schema ./schemas/config.schema.json

[generation]
default_model = "openai/MODEL_ID"

[logging]
level = "info"
```

They can choose a different CLI Default Model and enable more detailed logging for CLI operations, including those launched by the Overlay:

```toml
#:schema ./schemas/cli.schema.json

[overrides.generation]
default_model = "openrouter/MODEL_ID"

[overrides.logging]
level = "debug"
```

The Overlay can start with another Model and override English-only OCR with a language combination:

```toml
#:schema ./schemas/overlay.schema.json

[ocr]
languages = ["eng", "pol"]

[overrides.generation]
default_model = "google/MODEL_ID"
```

The Model IDs above are placeholders. Users can replace them with eligible IDs listed by `dictos models` for their Provider Connections. The schema comments show relative local paths. Generated starter files reference bundled, release-matched schema artifacts at a usable local path, so users do not need to copy schemas by hand.

### First-run files

On normal startup, create only the missing files in the application's load chain:

| Started application | Files created if missing                  |
| ------------------- | ----------------------------------------- |
| CLI                 | `config.toml`, `cli.toml`                 |
| Overlay             | `config.toml`, `cli.toml`, `overlay.toml` |

Each starter file contains its schema directive, a brief explanation of inheritance, and commented examples of its allowed settings with descriptions and defaults. Generate those comments and values from the same TypeScript definitions used for validation and editor schemas. Do not populate active settings from built-in defaults, environment values, command options, runtime choices, or legacy Model state. A starter file therefore behaves like an empty file until the user edits it, and future built-in defaults still apply to settings they have not enabled.

Create missing parent directories as needed. Never replace or update an existing configuration file, including an empty or malformed one. Concurrent startups must not overwrite each other's files or leave partial starter files. Help and version requests do not initialize configuration. File initialization requires no account, network access, or open Dictionary.

### Loading and precedence

Each command or Overlay opening resolves settings in this order, from lowest to highest priority:

1. Built-in shared and applicable-client defaults.
2. Global configuration.
3. CLI configuration, including its permitted shared overrides.
4. Overlay configuration when starting the Overlay, including its permitted overrides of inherited values.
5. Supported environment overrides.
6. Explicit command-specific options.

For example, with Default Models A in the global file, B in the CLI file, and C in the Overlay file, a CLI command starts with B and the Overlay starts with C. Removing the Overlay override makes it start with B, not A. Runtime selection and explicit command overrides still take priority over the configured starting choice.

Omitted keys inherit. Tables merge by setting path; higher-priority scalars and lists replace lower-priority values. Lists are never appended. Removing an override restores inheritance. Blank Model IDs, empty OCR language lists, unknown keys, and wrongly typed values are errors, not reset syntax.

Validate every loaded contribution before resolution. A higher-priority override cannot hide an invalid value in a lower-priority file. An invalid CLI file blocks both CLI and Overlay startup because both load it. An invalid Overlay file does not block direct CLI use. Check Model eligibility and Provider availability when using the Model, separately from configuration shape validation.

Only explicitly supported overrides apply; settings do not map automatically to environment variables or flags. This feature retains command-specific `--model` and the Overlay's `DICTOS_OCR_LANG` override. Configuration files do not expand environment references or include other files.

### Core Workflows

- **Scenario: Start without configuration files.** The first normal CLI invocation creates shared and CLI starter files. Opening the Overlay creates any missing shared, CLI, and Overlay starter files. Their settings are commented, so Dictos uses built-in defaults until the user edits them. Dictionary operations that do not need a Model remain available. Without a Default Model or explicit selection, generation asks the user to configure or choose a Model before making a Provider request.

- **Scenario: Share preferences while choosing client-specific behavior.** A CLI command inherits the global Default Model and logging level unless `cli.toml` overrides them. The Overlay inherits that CLI configuration, then applies its own Default Model override and OCR languages from `overlay.toml`. Its CLI-backed operations use the inherited logging level. Resolution retains each effective value's origin for diagnostics.

- **Scenario: Override a Model for one command.** When the user supplies `--model` to a generation command, the command uses that Model for the invocation. The next invocation starts from the configured Default Model. Neither command changes configuration or saves a device-wide selection. A syntactically valid but unavailable configured default does not block a valid explicit override.

- **Scenario: Change the Selected Model in the Overlay.** On opening, the Overlay initializes its Selected Model from the resolved Default Model, if configured. Choosing another eligible Model affects only that opening. Each suggestion or generation request includes the Overlay's Selected Model. Separate overlays can use different Models. If the user changes Models while suggestions or generation are running, late replies from the previous Model must not update the current suggestions or drafts. Changing Models preserves existing editor text. Closing and reopening, including after Cancel, starts from the configured default.

- **Scenario: Edit configuration while work is open.** A new CLI invocation reads the current files. An open Overlay keeps the configuration resolved from all three files at startup while allowing runtime Model selection. Its subprocesses use that snapshot, including the inherited CLI logging level, rather than rereading files after each action. The next Overlay opening reads the edited files.

- **Scenario: Configure OCR languages.** Without an override, the Overlay uses English OCR (`["eng"]`). A nonempty `ocr.languages` list changes that choice, and a supplied `DICTOS_OCR_LANG` takes precedence for that opening without changing the file. If initialization identifies missing language data, the launcher reports those identifiers on stderr before cleanup and exits without opening Quickshell. When the cause is unknown, the error names the requested languages and gives setup guidance. Dictos does not fall back to English when explicitly chosen languages are missing.

- **Scenario: Correct a configuration error.** For malformed TOML, unknown keys, disallowed overrides, invalid values, or unreadable files, the error message identifies the file or input source, setting path, and reason when available. Parse errors include available source locations. A failure to create a required missing starter file also identifies the target path and stops the requested operation. The message explains the failure without requiring users or clients to read subprocess stderr or decode a separate issue list. Dictos does not discard or rewrite existing files, or continue with replacement defaults after a configuration error. The launcher displays the same summary for Overlay startup failures. After opening, Notifications show the summary and preserve draft text. Machine-readable output keeps its existing envelope, with structured issues providing additional detail.

- **Scenario: Use or lose a Provider Connection.** Users can store a well-formed Default Model without a usable Provider Connection. Before generation, Dictos checks the Selected Model against its Model Catalog and connection. Missing, ineligible, disconnected, or Provider-rejected choices fail without selecting another Model or writing partial Dictionary data. Disconnecting a Provider leaves the configured Default Model unchanged. Manual editing and reviewed Save do not require a usable Model.

- **Scenario: Edit with completion and documentation.** With the release-matched schema associated with a TOML file, a compatible editor completes allowed sections and values, shows setting descriptions and defaults, and reports invalid settings. Global, CLI, and Overlay schemas expose their respective scopes, including allowed `overrides`. Local schemas work offline. Runtime validation uses application definitions and does not download editor schemas.

- **Scenario: Add a setting during development.** A maintainer defines its type, constraints, default, description, and scope once in TypeScript. Type inference, runtime validation, and generated editor schemas use that definition. A client-owned setting needs a definition and consumer, not a client-specific branch in file reading. The definitions can also support generated reference documentation later.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] Configuration Sync, Mirroring, database-backed configuration, and browser or Mobile storage.
- [ ] TUI configuration integration or settings interface, Web/Mobile development, and an Overlay UI redesign. This alpha covers CLI and Overlay behavior.
- [ ] Settings for the data directory, Dictos central-server URL, preferred monitor, or full/crop OCR modes. Provider endpoints and supported Provider routes are also out of scope.
- [ ] A logging system or configurable logging level for the Overlay's QML, launcher, or native OCR helper. This feature only configures the existing CLI logger.
- [ ] CLI or Overlay commands for editing configuration, a settings editor, a "make default" action, or a general configuration-update interface. Automatic writing is limited to creating missing starter files; existing files are never rewritten or refreshed on upgrade.
- [ ] `dictos model select`, persistent device-wide Model selection, remembering the last-used Model between openings, or resumable generation sessions. A future saved workflow may carry its Selected Model as state.
- [ ] Migration scripts, automatic conversion of the old saved Model choice, or a migration guide for the current user's local state. Clean up any legacy `selectedModel` manually and preserve `deviceId`.
- [ ] Configuration includes, project-local discovery, profiles, arbitrary environment interpolation, managed or remote configuration, plugins, or a generic read/write source framework.
- [ ] Live file watching or applying file edits to an open Overlay's configuration.
- [ ] Storing credentials, authentication sessions, device identity, Model Catalog caches, remembered Instruction text, selected Description Types, screenshots, or draft history in configuration.
- [ ] Changes to Dictionary records, Sync semantics, Description Types, generation proposal and commit rules, reviewed Save behavior, or Provider credential entry.
- [ ] A new Dictos language server, editor-schema lists that claim device-specific Model availability, or a complete generated reference site. Schema descriptions and local editor support are included.
- [ ] Overlay packaging, installation, or desktop hotkey distribution. Verify this feature with the existing checkout-based workflow.

## 5. Success Criteria (How do we know we are done?)

- [ ] Normal CLI startup creates missing shared and CLI starter files without creating an Overlay file. Overlay startup creates any missing files in all three layers. Initialization requires no account, network, or open Dictionary; non-generation CLI operations and manual Overlay saves work with all settings commented out.
- [ ] Starter files include usable local schema directives and comments generated from the setting definitions, with no active default values. Help/version requests create no configuration files. Existing files are preserved, and concurrent startups leave complete files without overwriting user content.
- [ ] CLI resolution follows shared → CLI; Overlay resolution follows shared → CLI → Overlay. The Overlay inherits the CLI Default Model when its own override is absent. CLI logging overrides apply to Overlay subprocesses, while the Overlay file rejects a logging override.
- [ ] Examples demonstrate precedence, table merging, list replacement, inheritance after deleting a key, and provenance for effective values.
- [ ] Invalid loaded values and file-access failures, including failure to create a missing starter file, produce exit code 5 with a useful source/key/reason summary in both human output and `CONFIGURATION_ERROR.message`. Model listing, Instruction listing, state helpers, and bootstrap preserve this result without replacing it with a generic operation/dependency failure. Overlay Notifications display the summary without depending on stderr or structured issues. Invalid CLI configuration blocks both clients; invalid Overlay configuration does not block direct CLI use. Higher-priority values cannot hide invalid settings in loaded files.
- [ ] The existing shared data location and valid device identity are preserved when adopting this feature.
- [ ] A generation command uses its explicit Model override or resolved Default Model. The override changes no saved settings or device-wide Model state. Dictos chooses no Model automatically when neither is available.
- [ ] Changing the Model in an open Overlay affects only its later requests. Concurrent overlays keep independent selections, and each new opening starts from its configured default.
- [ ] Overlay subprocesses retain the opening's configuration. A process-level check follows the production launch handoff through QML job construction to real CLI-backed and direct state operations after configuration files change. The opening's Selected Model, OCR languages, and inherited CLI logging level stay stable. A child receiving an invalid snapshot fails with exit 5 without reading or creating replacement configuration files. Isolated CLI tests and intercepted workspace signals alone do not verify this behavior.
- [ ] `dictos model select` is unavailable. Neither client uses the legacy persisted Model choice for generation, and disconnecting a Provider does not change configuration files.
- [ ] Generation checks eligibility and connections for the Selected Model. Missing or unusable Models cause no fallback and do not prevent manual editing or Save when configuration is valid.
- [ ] OCR defaults to English and uses configured languages when supplied, with the supported environment override taking precedence for that opening. Startup failures reach launcher stderr before cleanup, naming confirmed missing identifiers or the requested languages when the cause is unknown. On failure, Quickshell does not start and no automatic fallback occurs. Verify this through the launcher as well as the native helper.
- [ ] After missing starter files have been initialized, configuration loading, temporary overrides, Overlay selection, generation, Cancel, and Save leave configuration files unchanged. State and credential writes remain separate.
- [ ] Generated schemas for all three files provide completion, hover descriptions, and diagnostics in at least one compatible TOML editor using local schema files.
- [ ] File schemas allow omitted settings and reject prohibited scopes. Representative valid and invalid examples match runtime validation. Changing a definition regenerates its schema without a second setting definition.
- [ ] The same logical inputs can be validated and resolved without filesystem, environment, TOML parser, database, or UI access. Adding a setting does not duplicate defaults or validation in a storage adapter.
- [ ] The System Overview, Description Generation and Sync contracts, and CLI/Overlay usage documentation describe the implemented CLI-first configuration and Default/Selected Model behavior. Historical specifications stay unchanged.

## 6. Assumptions

- [ ] `config.toml`, `cli.toml`, and `overlay.toml`, with the snake_case setting paths shown above, define the initial file contract. Empty files and generated starter files contribute no overrides. Missing files in the load chain are initialized on normal startup.
- [ ] On Linux, configuration lives in `$XDG_CONFIG_HOME/dictos`, or `~/.config/dictos` when `XDG_CONFIG_HOME` is unset. Native adapters use the documented per-user location on other platforms. Discovery does not depend on the data directory or working directory.
- [ ] Both clients use the existing platform-specific shared data location, including the `XDG_DATA_HOME` convention on Linux. It is not a TOML setting.
- [ ] There is no built-in Default Model. Omit the setting to represent absence; an empty string, arbitrary catalog fallback, or special TOML reset value is invalid.
- [ ] The default CLI logging level is `info`. Overlay OCR defaults to `["eng"]` when no configuration or environment override is supplied.
- [ ] The initial value overrides are command-specific `--model` and Overlay `DICTOS_OCR_LANG`, which keeps its existing plus-separated language syntax. Conventional directory environment variables set discovery and fallback paths; they do not map automatically to every setting.
- [ ] Native file-format and language identifiers describe the current clients. Portable resolution does not depend on the operating system, installed OCR data, or live Provider access.
- [ ] The current user's persisted Model key can be removed manually. Legacy Model state is not a configuration source. Adopting configuration does not reset device identity or rewrite preferences.

## 7. Agreed Design Constraints

The platform-neutral `@dictos/config` module owns setting definitions, inferred types, defaults, validation, allowed scopes, precedence, resolution, and value origins. Consumers receive typed effective settings. The module accepts parsed logical contributions and explicit invocation inputs. It does not import filesystem or environment APIs, TOML parsing, database clients, or UI code.

The filesystem adapter handles discovery, create-if-missing initialization, reading, TOML decoding, and file-level diagnostics. Initialization is an explicit startup operation; the portable resolver does not create files. The shared module validates settings, including unknown-key rejection. Environment values and command options are transient inputs, not writable storage adapters. Application wiring chooses the CLI or Overlay load chain and supplies inputs without reimplementing defaults or merge rules. Future storage adapters can supply the same logical values without changing consumers or moving definitions into the adapter. This does not define future Sync behavior.

Core retains Model eligibility, Provider Connection checks, and other domain rules. It receives explicit domain inputs and does not look up configuration. Validating configuration shape does not require opening the Dictionary or checking Provider access for unrelated operations.

The Overlay resolves shared, CLI, and Overlay configuration once at startup, initializing any missing files in that chain. Its subprocesses receive the resolved snapshot, including the inherited CLI logging level, and each suggestion or generation request carries the current Selected Model. They do not select a different load chain or reread configuration for each action. All subprocesses continue using the existing shared storage conventions. The Overlay no longer uses the device-wide current-Model lookup as its source of truth. Pending-request and draft-history protections continue to distinguish requests made with different Model selections.

TypeScript runtime schemas define application validation, inferred types, editor schemas, and the descriptions, defaults, and examples used in starter files. Generated file schemas describe optional contributions. Apply defaults during resolution, after combining contributions, rather than to each source before merging. Starter-file rendering belongs with TOML tooling and uses the shared metadata rather than duplicating setting definitions. The technical plan chooses the schema library, TOML parser, schema-generation tooling, and internal context transport while preserving these contracts. Build-time schema export must not add native dependencies to portable runtime imports.

The [Default Model and Selected Model glossary entries](../../../CONTEXT.md) distinguish startup preferences from runtime choices. This feature replaces the device-wide selection behavior in the [Description Generation contracts](../../../docs/modules/description-generation/contracts.md) and follows the [shared local-data decision](../../../docs/adr/0007-share-local-data-across-clients.md) and [device-local credential decision](../../../docs/adr/0009-keep-provider-credentials-device-local.md). Update living implementation documentation with the feature; this specification does not say the behavior is already implemented.
