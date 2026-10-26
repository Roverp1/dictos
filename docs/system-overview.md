# System Overview: Dictos

**Last Updated**: Oct 26, 2026 | **Version**: 1.0.0-draft

## Project Purpose

Dictos is a local-first application for building and managing personal dictionaries. It allows users to save Entries from digital reading, organize them into Folders, group typed Descriptions under Senses, generate Descriptions with reusable or inline Instruction text, and export Dictionary data for spaced-repetition study. The current CLI-first alpha focuses on the Command Client and a development Wayland/Hyprland overlay for frozen-screen text selection, draft generation, and reviewed saves from the checkout. The Terminal UI remains maintained. The Web client is retained but broken and unmaintained; Mobile is planned for the future.

## High-Level Architecture

The monorepo uses Hexagonal Architecture to keep core business logic and headless React state independent of rendering environments and infrastructure. The TUI uses the shared Dictionary interaction model. The retained Web client was built around it but is broken and unmaintained; future Mobile clients may also use it. A local Turso SQLite-compatible database stores Dictionary data, with Turso push/pull handling cross-device synchronization. The central ElysiaJS server handles authentication and will support social features and the data Mirroring they require.

Description Generation follows the same boundaries. `packages/core` validates Model eligibility and generation inputs without depending on an AI library. The Command Client calls the selected Provider directly through `@dictos/ai-sdk`. Saved-Description generation reads a source Description and reusable Instruction, handles duplicate confirmation, and commits an accepted in-memory proposal atomically through `@dictos/db-core`. Unsaved Entry-based generation returns Sense suggestions or typed drafts without opening the Dictionary. Provider Connections and Model Catalog caches stay in device-local filesystem storage; the central server is not part of either generation path. A configured Default Model initializes the workflow's Selected Model, which can be replaced by a command-only `--model` or the Overlay picker without persistence. Provider setup and catalog browsing remain CLI workflows. Description Generation is available through the Command Client and development overlay, but not the TUI or Web client.

The portable `@dictos/config` module owns Zod definitions, inferred types, strict validation, defaults, allowed scopes, resolution, provenance, and immutable startup snapshots. `@dictos/fs-storage/configuration` handles native paths, TOML decoding, and safe creation of missing commented starter files. CLI commands load `config.toml` → `cli.toml`; an Overlay opening adds `overlay.toml` and passes its resolved snapshot to CLI children. File edits apply to new invocations; an open review keeps its startup settings. Settings cover the Default Model, existing CLI logger, and Overlay OCR languages. Core receives explicit Model inputs and has no configuration dependency. See the [configuration reference](./configuration.md) for locations, precedence, schemas, and failures. TUI/Web/Mobile configuration integration is not implemented.

The [standalone overlay client](./adr/0012-use-a-standalone-screen-review-client.md) uses Quickshell/QML with UI components adapted from Caelestia and Omarchy. `apps/overlay/run.sh` delegates to a launch coordinator that prepares configuration before capture or OCR. It freezes one monitor and starts a native C++ companion that keeps Tesseract initialized and retains the decoded image for full and crop OCR over a private Unix socket. OCR defaults to English; every configured language must load before Quickshell starts, with safe launcher diagnostics and no English fallback on failure. QML owns independent Entry/Description selections, the bottom drawer, draft editing, runtime Model choice, and session undo/redo. `dictos overlay` exchanges bounded newline-delimited JSON over stdin/stdout for Sense suggestions, generation, and reviewed saves; suggestion and generation requests carry an explicit qualified Model. A blank inline Instruction uses built-in task guidance. Choosing a suggested Sense preserves manual Description edits; explicit Generate replaces checked-Type drafts as one undoable action. Only reviewed Save writes Dictionary records: Entry plus optional unassigned `misc`, or Entry plus a new Sense and typed Descriptions, optionally including captured `misc`. Each Save includes one Activity increment in the same transaction and closes the overlay only after a valid success receipt and local-state flush.

The overlay runs independently of the TUI and desktop shell configuration. Its exact Instruction input and selected Description Types are stored in owner-only `<dataDir>/overlay-capture/state.json`, including after Cancel. Complete preference snapshots use instance-local write ordering and atomic replacement; screenshots and draft history are not persisted. The Selected Model belongs only to the open workflow. Device identity stays in `local-state.json`; credentials, authentication sessions, and configuration remain separate. The workflow uses the existing Dictionary schema without a migration. Installation, packaging, and an installed hotkey are deferred; see the [overlay README](../apps/overlay/README.md) for development commands and controls.

The Model Catalog lists eligible text-generation Models from a bundled models.dev snapshot or a validated device-local cache, with an explicit CLI refresh to update the cache. A shared eligibility check excludes embedding-only Models that models.dev also describes as text-capable; old caches without that check fall back to the bundled snapshot. Ordinary listing works offline and does not probe Providers' `/models` endpoints. Catalog entries are metadata, not proof of account access or trusted instructions for routing requests. `@dictos/ai-sdk` supports the fixed Provider IDs `openai`, `google`, `openrouter`, `deepseek`, and `groq`: native AI SDK adapters for OpenAI and Google, and fixed OpenAI-compatible routes for OpenRouter, DeepSeek, and Groq. New catalog Models can become selectable after refresh, but adding a Provider or changing its endpoint requires a reviewed code change.

## Tech Stack & Project Rules (The Constitution)

- **Architecture**: Clean / Hexagonal Architecture. Core domain logic (`packages/core`) MUST NOT depend on external libraries, frameworks, or DB drivers.
- **Interface Adapters**: The `@dictos/react` package acts as a headless controller, exposing shared state and intent actions while receiving domain services and infrastructure utilities (like Loggers and Notifiers) via Dependency Injection (`DictosProvider`). For the Dictionary view, it owns browse mode, entry mode, preview content, selection state, and context-menu targeting; clients provide the UI, input bindings, and platform-native Notification rendering.
- **Error Handling**: TypeScript uses "errors as values" with `errore` and `ReturnType | ErrorType` unions. Exceptions are reserved for unrecoverable failures or developer invariant violations. QML/JavaScript uses native exception handling at parsing and runtime boundaries, translating command/OCR failures into structured responses and user-visible Notifications. Pure overlay draft-state helpers stay non-throwing.
- **Testing**: Value over coverage. We favor testing against real boundaries (Integration Tests, local Turso server) over mocking internal infrastructure. Root test/typecheck commands exclude browser workspaces; there are no active Web/browser E2E tests. See `docs/testing.md` for the current verification boundary.
- **Overlay Verification**: Qt tests cover offscreen drawer interactions. The separate native suite covers the C++ helper through its socket and the production launch coordinator → Quickshell → command runner → CLI snapshot handoff with a headless fixture. That fixture does not instantiate the production screen shell. Manual settings checks cover Default Model setup, CLI use without a Default Model, and Polish OCR. Remaining interactive Wayland scenarios, live paid AI, and mixed-scale/multimonitor behavior remain unverified; error layout is provisional.
- **Logging**: The core domain is ignorant of logging. The presentation layer (`@dictos/react`) and adapters log execution outcomes using a generic `Logger` interface (`@dictos/logger`), fulfilled by concrete adapters (e.g., Pino) at the application composition root.
- **Configuration**: CLI configuration is lazy and cached per invocation. Missing starters are created without replacing existing files; help/version and parser failures do not create configuration. Strict errors retain exit 5 and an actionable summary through human output, JSON, and Overlay Notifications. Generated local schemas support offline TOML editing.
- **Description Generation**: Vercel AI SDK is isolated behind core-owned ports in `@dictos/ai-sdk`. Generation is non-streaming through native OpenAI and Google or fixed OpenAI-compatible routes; expected SDK compatibility warnings and provider failures are sanitized before structured logging.
- **Developer Environment**: Declarative and reproducible environments via `devenv.sh`.
- **Secret Management**: Native `devenv` integration with `SecretSpec` for secure runtime injection. Secrets are never stored in global shell environments or committed.
- **Frontend/Clients**: OpenTUI with React bindings (for the TUI client), Commander.js (for the Command Client), a development Quickshell/QML Wayland/Hyprland overlay with a native C++ Tesseract companion, a retained but unsupported Vite Web client, and future Mobile clients. The shared headless state is designed for keyboard, mouse, touch, and context-menu interactions across platforms.
- **Backend**: Bun, ElysiaJS.
- **Database**: Local Turso SQLite-compatible storage, Turso-hosted Sync, and Drizzle ORM.
- **Glossary**: See `CONTEXT.md` for strict domain terminology.

## Codebase Map

```text
/apps/tui/               # Terminal UI client (OpenTUI + React bindings)
/apps/cli/               # Command Client (Commander.js, script-oriented CLI)
/apps/overlay/           # Development Wayland/Hyprland overlay (Quickshell/QML + native Tesseract OCR)
/apps/web/               # Retained, unsupported Web client SPA (Vite + React Router)
/apps/server/            # ElysiaJS central backend for sync & social features
/packages/core/          # Pure domain entities, ports, and services
/packages/config/        # Portable settings, resolution, snapshots, and generated editor schemas
/packages/react/         # Headless shared UI logic, Dictionary state/actions, and provider wiring
/packages/db-core/       # Shared Drizzle schema, migrations, and generic repositories
/packages/ai-sdk/        # Fixed Provider routes, saved and unsaved Description Generation, Model Catalog
/packages/*-turso-sync/  # Platform-specific Turso DB clients (Bun; retained browser/WASM adapter)
/packages/*-storage/     # Native configuration, identity/session/credential storage, caches, and Overlay preferences
/packages/eden-http/     # Elysia Eden HTTP client adapter
/packages/pino-logger/   # Pino-based logger adapter implementation
/packages/logger/        # Shared generic Logger interface port
```

## Domain Modules

- **Dictionary Management**: Entries, typed Descriptions, Senses, Folders, Activity, and atomic reviewed screen saves. Root Entry identity is reused; Sense saves create a new Sense and all chosen Descriptions together. See: [Documentation Module - Dictionary Management](./modules/dictionary-management/domain.md)
- **Description Generation**: Reusable Instructions, device-local Provider Connections and Default Models, workflow-local Selected Models, the Model Catalog, saved-Description proposals, and unsaved Entry-based Sense suggestions and typed drafts. Core owns validation, `@dictos/ai-sdk` owns fixed Provider routes and requests, and `@dictos/db-core` owns atomic persistence. Generation never chooses a fallback Model automatically. Credentials, catalog caches, and configuration do not Sync or enter the central server; runtime selection is not persisted. See: [Documentation Module - Description Generation](./modules/description-generation/domain.md)
- **Import/Export**: Handles ingesting raw text from various sources and `Export` of data (e.g., to Anki, JSON).
- **Sync**: Handles the rules and conflict resolution for the bidirectional replication of private local data across a single user's devices. See: [Documentation Module - Sync](./modules/sync/domain.md)
- **Social**: Handles `Mirroring` of data to the central server for public viewing and socialization features.
