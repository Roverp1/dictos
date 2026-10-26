# Dictos

> Local-first, keyboard-driven, and cross-platform personal dictionaries, for extremely low friction.

Dictos is an open-source app for building and managing personal dictionaries while reading, learning, and collecting language material. It stores your data locally first, keeps the interface fast, and is designed to sync across devices without making the network the source of truth.

The project is still early. The current CLI-first alpha focuses on the Command Client and a development Wayland/Hyprland screen overlay. The Terminal UI remains maintained. The central server is under development. The Web client code remains in the repo, but the app is broken and unmaintained.

## Quick Start

The supported development workflow assumes a `devenv shell` environment.

```bash
git clone git@github.com:Roverp1/dictos.git
cd dictos
devenv shell

secretspec config init
secretspec check

bun install
bun run dev:cli entry list
```

The first normal CLI invocation creates missing shared and CLI configuration files with commented settings. See [application configuration](./docs/configuration.md) for locations and Default Model setup. Local Dictionary commands do not require the central server. Run `devenv up` when developing the server/Sync stack, or `bun run dev:tui` for the Terminal UI.

## What It Does

Dictos helps you build a personal Dictionary from text you care about.

- **Entries** - Words, phrases, or sentences saved from reading or entered manually.
- **Descriptions** - Explanations, translations, examples, or other text attached to an Entry.
- **Folders** - Nested containers for organizing Entries.
- **Instructions** - Reusable templates for generating Descriptions with an LLM API.
- **Sync** - Local-first replication across your devices.
- **Export** - Planned output to external formats such as Anki, JSON, or your favorite learning app.

See [`CONTEXT.md`](./CONTEXT.md) for the project vocabulary. The terms are deliberate because they shape the domain model and UI.

## Status

Dictos is intended to become a serious open-source app for outside users, but it is not polished enough for casual users yet.

Current state:

- The alpha focuses on the Command Client and development Overlay; the Terminal UI remains maintained.
- The Command Client supports Dictionary management and Description Generation. The development screen overlay reviews OCR text and generated drafts before saving; installation and packaging are deferred.
- Web client code remains in the repo, but the app is broken, unmaintained, and unsupported. Routine checks do not cover it.
- Central server exists for auth, sync setup, and future social features.
- Mobile is part of the longer-term architecture, not the current product surface.
- APIs, storage details, and UX can still change hard.

## Features

- **Local-first data** - Your Dictionary lives locally and should keep working offline.
- **Keyboard-first workflow** - The TUI is built for fast navigation and editing.
- **Cross-platform architecture** - Shared domain and headless UI logic are reused across clients.
- **Turso database** - Local persistence with sync-oriented database adapters.
- **Headless React controller** - `@dictos/react` owns shared interaction state while clients render their own UI.
- **Screen text review** - A Quickshell overlay freezes one monitor, lets you correct independent Entry/Description selections, and saves reviewed Sense/Description drafts atomically.
- **Application configuration** - Shared and client TOML files configure Default Models, CLI logging, and Overlay OCR, with commented starters and offline editor schemas.
- **Server-backed sync setup** - The central ElysiaJS server supports auth and database provisioning flows.

## Requirements

Recommended:

- [devenv](https://devenv.sh/) 2.x
- Nix, as required by devenv

Provided by `devenv shell`:

- Bun
- Turso CLI / `tursodb`
- SecretSpec
- GitHub CLI
- Development environment variables
- Local process wiring for the central server and sync server
- Additional local directory setup

Manual setup is possible, but you must recreate the work that devenv automates. That means installing the tools above, setting the environment variables, configuring secrets, creating expected local data directories, running the local sync server, and starting each process yourself.

## Development

Enter the development environment first:

```bash
devenv shell
```

Install dependencies:

```bash
bun install
```

Run the Command Client:

```bash
bun run dev:cli entry list
```

Use the [CLI README](./apps/cli/README.md) for Provider Connections and generation. A file-based Default Model initializes the Selected Model for each command or Overlay opening. `--model` and the Overlay picker choose a Model for current work without saving that selection. The [configuration reference](./docs/configuration.md) describes inheritance and defaults.

Run the Terminal UI:

```bash
bun run dev:tui
```

Run the screen overlay from a Wayland/Hyprland session:

```bash
devenv --profile overlay shell -- bun run dev:overlay
```

See the [overlay README](./apps/overlay/README.md) for OCR language data, keyboard/mouse controls, and native checks. Suggestions and generation need a configured Provider Connection and Selected Model; manual editing and Save do not.

The Web client has a manual development command, but is currently broken and unsupported:

```bash
bun run dev:web
```

Run the central server:

```bash
bun run dev:server
```

Run the local server/sync stack managed by devenv:

```bash
devenv up
```

Typecheck the maintained workspaces (browser workspaces are excluded from the root command):

```bash
bun run typecheck
```

## Secrets

Dictos uses [SecretSpec](https://devenv.sh/integrations/secretspec/) through devenv.

If this is your first time entering the shell, initialize a SecretSpec backend when prompted:

```bash
secretspec config init
```

Then check or fill missing secrets:

```bash
secretspec check
```

Development defaults are declared in [`secretspec.toml`](./secretspec.toml). Production-like server flows need real values.

| Variable               | Purpose                               | Development default            |
| ---------------------- | ------------------------------------- | ------------------------------ |
| `JWT_SECRET`           | Signs auth tokens                     | Generated by SecretSpec        |
| `TURSO_ORG_SLUG`       | Turso organization slug               | `local-dev-org`                |
| `TURSO_PLATFORM_TOKEN` | Turso Platform API token              | Local placeholder              |
| `TURSO_SYNC_URL`       | Local sync server URL                 | `http://localhost:8080`        |
| `TURSO_DATABASE_URL`   | Central server database URL           | `file:.data/central-server.db` |
| `TURSO_AUTH_TOKEN`     | Auth token for remote Turso database  | unset                          |
| `GEMINI_API_KEY`       | Optional live Gemini generation check | unset                          |
| `PORT`                 | Central server port                   | `1488`                         |

## Manual Setup Notes

Use devenv if you can.

Without devenv:

- read `devenv.nix` to figure out what needs to be done.
- figure it out
- ask `Roverp1` for help

## Project Structure

```text
apps/tui/                 Terminal UI client using OpenTUI + React
apps/cli/                 Script-oriented Command Client
apps/overlay/             Development Quickshell/QML overlay with native Tesseract OCR
apps/web/                 Retained, unsupported Web client (Vite + React Router)
apps/server/              ElysiaJS central server
packages/core/            Pure domain logic, ports, and services
packages/config/          Portable configuration, snapshots, and editor schemas
packages/react/           Headless shared UI state and actions
packages/db-core/         Shared Drizzle schema and repositories
packages/ai-sdk/          Description Generation and Model Catalog adapters
packages/bun-turso-sync/  Bun/local Turso sync adapter
packages/wasm-turso-sync/ Browser/WASM Turso sync adapter
packages/fs-storage/      Native TOML configuration and filesystem storage
packages/local-storage/   Browser localStorage adapter
packages/eden-http/       Elysia Eden HTTP client adapter
packages/logger/          Shared logger interface
packages/pino-logger/     Pino logger adapter
```

## Architecture

Dictos uses a hexagonal architecture.

The core domain lives in `packages/core` and must not depend on React, UI frameworks, database drivers, logging implementations, or platform APIs. Infrastructure details are pushed into adapters and injected through ports.

`@dictos/react` is a headless controller for Dictionary interaction state: browse mode, entry mode, preview content, cursors, selection, and context-menu targets. The TUI uses it today. The retained Web client was built around it but is broken and unmaintained.

`@dictos/config` owns portable settings and resolution. `@dictos/fs-storage/configuration` handles native file discovery, commented starters, and TOML decoding. CLI commands resolve settings once; an Overlay passes its startup snapshot to CLI children while keeping Model choice local to the opening. The TUI does not yet consume these TOML settings.

For the full architecture, read [`docs/system-overview.md`](./docs/system-overview.md).

## Documentation

- [`docs/system-overview.md`](./docs/system-overview.md) - Purpose, architecture, stack, and codebase map.
- [`docs/configuration.md`](./docs/configuration.md) - Configuration locations, scopes, defaults, schemas, and failure behavior.
- [`apps/cli/README.md`](./apps/cli/README.md) - CLI usage, overlay JSON protocol, and retained screen-region shortcut.
- [`apps/overlay/README.md`](./apps/overlay/README.md) - Development launcher, OCR build/checks, and review controls.
- [`CONTEXT.md`](./CONTEXT.md) - Project terminology.
- [`docs/testing.md`](./docs/testing.md) - Testing strategy and rules.
- [`docs/adr`](./docs/adr) - Architecture decisions.

## Troubleshooting

### `devenv shell` is not available

Install devenv using the official guide: <https://devenv.sh/getting-started/>.

If you do not want to use devenv, follow the manual setup notes and expect extra work. The repo assumes devenv during development.

### SecretSpec says secrets are missing

Initialize a backend and fill the required secrets:

```bash
secretspec config init
secretspec check
```

### Web client does not work locally

The Web client is currently broken and unmaintained. `devenv up` starts the sync server and central server, but does not start or verify the Web client. Its browser/WASM flows have no active E2E coverage; see [`docs/testing.md`](./docs/testing.md).

## Contributing

Contributions are extremely welcome, but the project is still moving quickly. For larger changes, open an issue first.

Before changing domain or architecture code, read:

- [`CONTEXT.md`](./CONTEXT.md)
- [`docs/system-overview.md`](./docs/system-overview.md)
- [`docs/testing.md`](./docs/testing.md)

For questions, open a GitHub issue or contact Yaroslav Gulevsky at `yar.zubaha@proton.me`.

## AI Policy

All the main production code is currently written by hand, with AI being used only for assistance. The current `web` app is an exception, as it was fully generated from the `tui` app, for exploration purposes, and will require full human rewrite, before it will be considered _production_ ready.
Also all of the documentation (including github issues, and pr's) are mostly generated with AI, but fully review, and lightly edited, to keep it factual. As the project grows - the documentation will need to be rewritten by a human, and will have a higher quality enforcment.

For more information read [`AI Policy`](./AI_POLICY.md) (adapted from [Ghosty AI Policy](https://github.com/ghostty-org/ghostty))

## License

Dictos is licensed under the GNU Affero General Public License v3.0. See [`LICENSE`](./LICENSE).
