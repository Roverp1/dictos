# System Overview: Dictos

**Last Updated**: Sep 25, 2026 | **Version**: 1.0.0-draft

## Project Purpose

Dictos is a local-first application for building and managing personal dictionaries. It allows users to save Entries from digital reading, organize them into Folders, group typed Descriptions under Senses, generate Descriptions with reusable Instructions, and export Dictionary data for spaced-repetition study. Users interact with Dictos through a Terminal UI, Command Client, and Web client, with Mobile planned for the future.

## High-Level Architecture

The project uses a monorepo structure. It employs Hexagonal Architecture to isolate core business logic and headless React state from specific rendering environments or infrastructure. This separation allows the core logic and shared Dictionary interaction model to be reused across the current TUI, Web client, and future Mobile client. Dictionary data is persisted in a local Turso SQLite-compatible database, with cross-device synchronization handled through Turso push/pull. The central ElysiaJS server handles authentication and will support social features and the data Mirroring they require.

Description Generation follows the same boundaries. `packages/core` builds and validates an in-memory proposal without depending on an AI library. The Command Client calls the selected provider directly through `@dictos/ai-sdk`, handles duplicate confirmation, and commits an accepted proposal atomically through `@dictos/db-core`. Provider credentials stay outside the Dictionary database in device-local filesystem storage; the central server is not part of the generation path.

## Tech Stack & Project Rules (The Constitution)

- **Architecture**: Clean / Hexagonal Architecture. Core domain logic (`packages/core`) MUST NOT depend on external libraries, frameworks, or DB drivers.
- **Interface Adapters**: The `@dictos/react` package acts as a headless controller, exposing shared state and intent actions while receiving domain services and infrastructure utilities (like Loggers and Notifiers) via Dependency Injection (`DictosProvider`). For the Dictionary view, it owns browse mode, entry mode, preview content, selection state, and context-menu targeting; clients provide the UI, input bindings, and platform-native Notification rendering.
- **Error Handling**: "Errors as values" using the `errore` package is preferred in almost every case. Return `ReturnType | ErrorType` unions. Only `throw` exceptions for truly exceptional circumstances, some exapmles include but not limited to: unrecoverable system errors, deep stack bubbling (e.g., global middleware catching low-level crashes), or violations of invariants/developer mistakes (e.g., out-of-bounds array access).
- **Testing**: Value over coverage. We favor testing against real boundaries (Integration Tests, local Turso server) over mocking internal infrastructure. See `docs/testing.md` for full strategy.
- **Logging**: The core domain is ignorant of logging. The presentation layer (`@dictos/react`) and adapters log execution outcomes using a generic `Logger` interface (`@dictos/logger`), fulfilled by concrete adapters (e.g., Pino) at the application composition root.
- **Description Generation**: Vercel AI SDK is isolated behind core-owned ports in `@dictos/ai-sdk`. Generation is non-streaming and OpenAI-compatible; expected SDK compatibility warnings and provider failures are sanitized before structured logging.
- **Developer Environment**: Declarative and reproducible environments via `devenv.sh`.
- **Secret Management**: Native `devenv` integration with `SecretSpec` for secure runtime injection. Secrets are never stored in global shell environments or committed.
- **Frontend/Clients**: OpenTUI with React bindings (for the TUI client), Commander.js (for the Command Client), a Vite Web client, and future Mobile clients. Each client should lean on its most natural input first, but the shared headless state is built to handle keyboard, mouse, touch, and context-menu interactions on every platform.
- **Backend**: Bun, ElysiaJS.
- **Database**: Local Turso SQLite-compatible storage, Turso-hosted Sync, and Drizzle ORM.
- **Glossary**: See `CONTEXT.md` for strict domain terminology.

## Codebase Map

```text
/apps/tui/               # Terminal UI client (OpenTUI + React bindings)
/apps/cli/               # Command Client (Commander.js, script-oriented CLI)
/apps/web/               # Web client SPA (Vite + React Router)
/apps/server/            # ElysiaJS central backend for sync & social features
/packages/core/          # Pure domain entities, ports, and services
/packages/react/         # Headless shared UI logic, Dictionary state/actions, and provider wiring
/packages/db-core/       # Shared Drizzle schema, migrations, and generic repositories
/packages/ai-sdk/        # OpenAI-compatible Description Generation and Model discovery adapter
/packages/*-turso-sync/  # Platform-specific Turso DB clients (bun, wasm)
/packages/*-storage/     # Platform-specific local storage adapters (fs, local-storage)
/packages/eden-http/     # Elysia Eden HTTP client adapter
/packages/pino-logger/   # Pino-based logger adapter implementation
/packages/logger/        # Shared generic Logger interface port
```

## Domain Modules

- **Dictionary Management**: Core domain handling `Entries`, `Descriptions`, `Senses`, `Folders`, and basic `Activity` tracking. See: [Documentation Module - Dictionary Management](./modules/dictionary-management/domain.md)
- **Description Generation**: Manages reusable `Instructions`, device-local `Provider Connections`, per-command Model selection, and typed Description Generation. `packages/core` owns proposal and validation rules, `@dictos/ai-sdk` owns the OpenAI-compatible provider boundary, and `@dictos/db-core` owns atomic proposal persistence. Generation is available only through the Command Client in this iteration. Provider credentials never enter the synced Dictionary database or central server. See: [Documentation Module - Description Generation](./modules/description-generation/domain.md)
- **Import/Export**: Handles ingesting raw text from various sources and `Export` of data (e.g., to Anki, JSON).
- **Sync**: Handles the rules and conflict resolution for the bidirectional replication of private local data across a single user's devices. See: [Documentation Module - Sync](./modules/sync/domain.md)
- **Social**: Handles `Mirroring` of data to the central server for public viewing and socialization features.
