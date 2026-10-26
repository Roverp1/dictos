# Application configuration

The Command Client and development Overlay use device-local TOML files. A normal startup creates any missing files with a local schema directive and commented settings. Edit those files to choose persistent preferences.

The TUI, retained Web client, and future Mobile client do not consume this configuration. Dictionary data, credentials, authentication sessions, device identity, Model Catalog caches, and remembered Overlay inputs have separate storage. Configuration does not Sync or enter Mirroring.

## Locations and startup

| Platform                               | Configuration directory                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Linux and other XDG-style environments | `$XDG_CONFIG_HOME/dictos` when `XDG_CONFIG_HOME` is absolute; otherwise `<home>/.config/dictos`        |
| macOS                                  | `<home>/Library/Preferences/dictos`                                                                    |
| Windows                                | `%APPDATA%\dictos\config` when `APPDATA` is absolute; otherwise `<home>\AppData\Roaming\dictos\config` |

Relative directory environment values are ignored. Discovery does not search the working directory and is independent of the existing shared data-directory conventions, including `XDG_DATA_HOME` on Linux.

| Invocation          | Files loaded, in order                    |
| ------------------- | ----------------------------------------- |
| Direct CLI command  | `config.toml`, `cli.toml`                 |
| New Overlay opening | `config.toml`, `cli.toml`, `overlay.toml` |

Normal command startup initializes its file chain without requiring an account or usable Model. Help, version, and parser usage failures do not initialize configuration. Malformed Overlay operation requests also fail before configuration startup.

Every starter contains descriptions, examples, and defaults, but its tables and assignments are commented out. It therefore contributes no values until edited. Existing files are never rewritten, including empty or malformed files and symlinks. Concurrent startups publish complete starter files without replacing one another's work. Creation is per file; a later failure can leave earlier complete starters in place.

## Settings and examples

| Setting                    | Built-in default | Permitted files                           |
| -------------------------- | ---------------- | ----------------------------------------- |
| `generation.default_model` | No Model         | Global; CLI and Overlay under `overrides` |
| `logging.level`            | `"info"`         | Global; CLI under `overrides`             |
| `ocr.languages`            | `["eng"]`        | Overlay only                              |

Keep the schema directive created by Dictos. The examples below show enabled settings and omit that machine-specific directive.

### Shared settings: `config.toml`

```toml
[generation]
default_model = "openai/MODEL_ID"

[logging]
level = "info"
```

Replace `openai/MODEL_ID` with an eligible qualified ID from `dictos models`. Configuration checks the `provider/model` shape, including further slashes in the Model part. It does not require a connected Provider or catalog entry until the Model is used. Whitespace and blank parts are invalid.

Logging accepts `trace`, `debug`, `info`, `warn`, `error`, or `fatal`. It controls the existing CLI logger, including CLI children started by the Overlay. It does not configure QML, launcher, or native OCR diagnostics.

### CLI overrides: `cli.toml`

```toml
[overrides.generation]
default_model = "openrouter/MODEL_ID"

[overrides.logging]
level = "debug"
```

The Overlay inherits these CLI preferences too.

### Overlay settings: `overlay.toml`

```toml
[overrides.generation]
default_model = "google/MODEL_ID"

[ocr]
languages = ["pol"]
```

The Overlay may override the Default Model, but cannot override logging. Writing `[overrides.logging]` here is an error.

OCR languages are an ordered, nonempty list of Tesseract identifiers. Examples include `eng`, `pol`, and `script/Latin`. Each item names one language: use `["eng", "pol"]`, rather than `["eng+pol"]`. Whitespace, blank identifiers, and empty path segments are invalid. The list replaces English; it is not appended to the default.

## Inheritance and transient inputs

The resolver validates every loaded file before choosing effective values. It applies global → CLI → Overlay contributions for the selected client, then the supported environment override. Missing settings receive built-in defaults after resolution.

Omitted keys inherit. A supplied scalar or list replaces the previous value; lists never append. With Models A in the global file, B in CLI overrides, and C in Overlay overrides, a direct command starts with B and an Overlay starts with C. Deleting the Overlay assignment restores B. Omitting every Model assignment leaves no Default Model; neither an empty string nor TOML `null` is reset syntax.

An invalid lower-priority value remains an error even if a later override or command option would replace it. An invalid CLI file blocks both clients. An invalid Overlay file does not affect direct CLI commands.

Only two value overrides are supported:

- A generation command's `--model <provider/model>` chooses the Selected Model for that invocation instead of its configured Default Model.
- `DICTOS_OCR_LANG` replaces the Overlay language list for a new opening. It uses plus-separated identifiers, such as `eng+pol`. Unset or empty means no override.

For example, from the checkout:

```bash
DICTOS_OCR_LANG=eng+pol devenv --profile overlay shell -- bun run dev:overlay
```

There is no automatic environment-variable mapping for other settings, variable expansion inside TOML, project-local discovery, include mechanism, file watching, or configuration-editing command.

## Default and Selected Models

A Default Model initializes new work. The Selected Model belongs to the current command or open Overlay. A command-only override or Overlay picker choice leaves configuration unchanged.

Without a Default Model, non-generation commands and manual Overlay editing and Save remain available. Generation then requires an explicit Selected Model and fails without one. It never chooses a fallback. `dictos model select` and `dictos model current` have been removed. Provider disconnect removes the credential without editing the configured Default Model.

An unavailable but structurally valid Default Model can be replaced by a valid `--model` choice. The Model actually used still passes the existing eligibility and Provider Connection checks. See the [CLI workflow](../apps/cli/README.md) for Provider setup and generation commands.

## Stable settings in the Overlay

Before capture or native OCR starts, the launcher runs `dictos overlay bootstrap --json`. Bootstrap reads the current three-file chain, even when its parent supplied an older snapshot. It does not open the Dictionary, initialize device identity, read credentials, or make network requests.

The launcher validates bootstrap output and exports a compact version-1 snapshot through process-local `DICTOS_OVERLAY_CONFIG_SNAPSHOT`. It contains effective settings and their origins. This is internal transport inherited by Quickshell and its CLI children, not a user preference.

Children use that snapshot, including the CLI logging level, without rereading TOML or reapplying language environment input. A present invalid snapshot fails with exit 5 rather than falling back to files. Snapshot transport is bounded to 16 KiB; captured bootstrap output is bounded to 1 MiB.

The workspace starts from the snapshot's Default Model. Picker changes are local and each suggestion or generation request includes the current qualified Model. Runtime selection is absent from the snapshot and remembered Overlay state. Separate openings keep separate choices, and a new opening reads edited configuration.

## OCR language failures

English is the built-in OCR language. A configured or environment-supplied list replaces it completely. Install the requested Tesseract language data in the environment used to launch the Overlay.

The native helper verifies that every requested language loaded before reporting readiness. A partially loaded combination fails too. The launcher reports confirmed missing identifiers, or the requested languages when initialization cannot identify the cause, with local setup guidance. It exits nonzero before Quickshell and does not retry with English. Raw helper stderr is not the user-facing error protocol.

## Configuration errors

Files must be valid UTF-8 TOML and at most 256 KiB each. Tables and leaves may be omitted, but unknown keys, disallowed scopes, invalid types and values, unreadable files, and starter-creation failures stop the operation. Dictos does not rewrite the files or continue with replacement defaults.

CLI configuration failures use exit 5. Human stderr and JSON `CONFIGURATION_ERROR.message` identify the source, offending setting, reason, and available location. JSON failures also include a nonempty `issues` list for structured detail. For example:

```text
cli.toml (overrides.logging.level): Expected trace, debug, info, warn, error, or fatal.
```

The Overlay launcher preserves that summary for bootstrap failures. After opening, command failures display it in a Notification while preserving drafts. Raw settings, environment payloads, parser causes, and credentials are not diagnostic output. Full request and response contracts are in the [CLI README](../apps/cli/README.md#handled-failures).

## Editor schemas and development

Generated starters point to release-matched local `file:` URIs. The self-contained Draft 4 schemas work offline and are exported as data assets:

| File           | Exported schema                              |
| -------------- | -------------------------------------------- |
| `config.toml`  | `@dictos/config/schemas/config.schema.json`  |
| `cli.toml`     | `@dictos/config/schemas/cli.schema.json`     |
| `overlay.toml` | `@dictos/config/schemas/overlay.schema.json` |

Associate the corresponding schema in a compatible TOML editor if it does not pick up the directive. Existing directives are not refreshed automatically; if the checkout moves, update the directive or editor association to the bundled asset's new location. Schemas describe permitted file inputs, not Models available to a particular account.

Setting definitions, types, runtime validation, schema metadata, and starter descriptions share one source in `packages/config/src/definitions.ts`. After changing definitions, run:

```bash
bun run --cwd packages/config generate:schemas
bun run --cwd packages/config check:schemas
```

Generation writes deterministic assets. The check detects drift without writing and runs in the package test command. Generated assets keep their generator formatting; Prettier excludes them. Neither generation tooling nor native filesystem/TOML code is imported through the portable runtime entry point.

See [the portable package](../packages/config/README.md) and [the native adapter](../packages/fs-storage/README.md) for APIs and ownership.

## Verification and limits

Automated checks cover resolution, runtime/schema agreement, real-file initialization races, CLI startup and Model inputs, offscreen QML editing, native OCR, and the production launch coordinator's QML-to-CLI snapshot handoff. The process fixture uses production command components but does not instantiate the production screen shell.

Offline schema integration was checked with headless Neovim 0.12.4 and Tombi LSP 0.10.4. Manual checks reported working TOML LSP integration, configuring a Default Model, CLI behavior without a Default Model, and changing OCR from English to Polish (`pol`). The manual editor/LSP was not specified.

The remaining interactive Wayland scenarios, mixed-scale/multimonitor behavior, and live paid-Provider access remain unverified. Browser/WASM behavior is outside the supported verification scope. Detailed results are in the [archived implementation record](../specs/.archive/011-application-configuration/tasks.md#verification-notes-2026-10-22).
