# @dictos/fs-storage

Native filesystem adapters for device-local storage and application configuration. Configuration uses a separate entry point so callers can load settings without constructing session, credential, or Dictionary dependencies.

## Configuration entry point

Import from `@dictos/fs-storage/configuration`:

| Export                                                                    | Contract                                                                                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `resolveNativeConfigurationPaths({platform, homeDirectory, environment})` | Returns `NativeConfigurationPaths \| ConfigurationError`. Discovers the configuration directory and bundled schema file URIs without creating directories or settings files.         |
| `initializeAndLoadConfiguration({client, paths, ocrLanguageEnvironment})` | Returns `Promise<ConfigurationSnapshot \| ConfigurationError>`. Creates missing starters in the selected chain, reads TOML, and delegates validation/resolution to `@dictos/config`. |
| `NativeConfigurationPaths`                                                | `{directory, schemaUris}`, with a schema URI for each of `global`, `cli`, and `overlay`.                                                                                             |

See the [configuration reference](../../docs/configuration.md) for platform locations, scope rules, precedence, and supported overrides. The adapter follows the finite load chain from [`@dictos/config`](../config/README.md): CLI loads `config.toml` and `cli.toml`; Overlay also loads `overlay.toml`. Discovery uses explicit platform, absolute home directory, and environment inputs, independently of the data directory and working directory. Relative XDG/APPDATA directory inputs use the platform fallback rather than the working directory.

```ts
import {
  initializeAndLoadConfiguration,
  resolveNativeConfigurationPaths,
} from "@dictos/fs-storage/configuration";

export async function loadExample() {
  const paths = resolveNativeConfigurationPaths({
    platform: "linux",
    homeDirectory: "/home/example",
    environment: { XDG_CONFIG_HOME: "/home/example/.config" },
  });
  if (paths instanceof Error) return paths;
  return initializeAndLoadConfiguration({
    client: "cli",
    paths,
    ocrLanguageEnvironment: null,
  });
}
```

This example initializes missing files under the supplied home. Callers explicitly initialize configuration at startup; importing the package or resolving paths creates no files.

### Starter publication and reads

Schema assets resolve through the exported `@dictos/config/schemas/*.json` paths to absolute local `file:` URIs. Path discovery checks their availability, and loading verifies applicable artifacts before creating starters. A missing artifact returns an error instead of publishing a broken schema directive.

Starter text uses shared setting metadata for descriptions, defaults, and examples. It includes a schema directive and scope-specific inheritance comments; all setting tables and assignments stay commented. It never copies current effective values or environment inputs into the file.

Missing parents are created with owner-only permissions. Each starter is written completely to an exclusively created, owner-only temporary file in the target directory, closed, then published with `fs.link`. A concurrent `EEXIST` means another creator won; loading reads that target. Temporary files are removed. Publication does not use an overwriting rename or a persistent lock directory.

Existing files are read only, including empty or malformed files. Existing symlinks are preserved and may be followed to regular files. Directories, devices, FIFOs, unreadable targets, invalid UTF-8, and files larger than 256 KiB fail with configuration issues. TOML parsing uses `smol-toml`; available parse locations become safe line/column diagnostics. Initialization is per-file, so an unsuccessful startup can leave complete starters already created earlier in the chain.

For Overlay only, a nonempty `ocrLanguageEnvironment` is split on `+` and passed to portable validation as the complete replacement language list. Empty or null means no environment override. The adapter does not check installed language data. Children with an inherited snapshot bypass this adapter and do not reapply live environment overrides.

There is no API for editing existing configuration. Discovery, initialization, reads, parsing, and semantic validation return `ConfigurationError` values with safe source/key/location issues. They do not require a Dictionary, device identity, authentication session, credentials, or network request.

## Storage entry point

`@dictos/fs-storage` exports the filesystem repositories, data-directory helpers, and Overlay preference types. These stores are separate from TOML configuration:

| Export / file under `<dataDir>`                                  | Purpose                                                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FsLocalStateRepository` / `local-state.json`                    | Device identity (`deviceId`), not Model selection. Invalid JSON or identity returns a storage error rather than generating a replacement identity. |
| `FsProviderConnectionRepository` / `providers.json`              | Device-local Provider Connections and credentials.                                                                                                 |
| `FsSessionRepository` / `session.json`                           | Authentication session.                                                                                                                            |
| `FsModelCatalogStore` / `model-catalog.json`                     | Local Model Catalog cache.                                                                                                                         |
| `FsOverlayCaptureStateRepository` / `overlay-capture/state.json` | Remembered Instruction text and selected Description Types, not the Selected Model, screenshots, drafts, or undo history.                          |

`getAppDataDir(appName)` computes the existing platform data location. `getDictosDataDir()` creates the Dictos data directory and returns `Promise<string | StorageError>`. On Linux it follows `XDG_DATA_HOME`, falling back to `~/.local/share/dictos`; this is distinct from configuration discovery. Dictionary persistence belongs to the database adapters. Configuration and these device-local stores do not participate in Sync or Mirroring.

## Checks

From the repository root:

```bash
bun run --cwd packages/fs-storage typecheck
bun run --cwd packages/fs-storage test
```

Configuration checks use real temporary files and concurrent processes for bounded reads, local schema references, preservation of existing files/symlinks, and create-if-missing publication.
