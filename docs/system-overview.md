# System Overview: Dictos

**Last Updated**: Aug 07, 2026 | **Version**: 1.0.0-draft

## Project Purpose

Dictos is a local-first, application for building and managing personal dictionaries. It allows users to capture text fragments (Entries) from digital reading, organize them into Folders, generate LLM-powered explanations (Descriptions) using reusable templates (Instructions), and export the data for spaced-repetition study (e.g., Anki). Users interact with Dictos through first-class clients: a Terminal UI, a Command Line Interface, and a Web client, with Mobile (React Native) planned for the future.

## High-Level Architecture

The project uses a monorepo structure. It employs Hexagonal Architecture to isolate core business logic and headless React state from specific rendering environments or infrastructure. This separation allows the core logic and shared Dictionary interaction model to be reused across the current TUI, Web client, and future Mobile client. Data is persisted locally via libSQL, and cross-device synchronization will be handled via native libSQL push/pull features utilizing Turso hosting. The central ElysiaJS will handle social features and data mirroring required for these social features.

## Tech Stack & Project Rules (The Constitution)

- **Architecture**: Clean / Hexagonal Architecture. Core domain logic (`packages/core`) MUST NOT depend on external libraries, frameworks, or DB drivers.
- **Interface Adapters**: The `@dictos/react` package acts as a headless controller, exposing shared state and intent actions while receiving domain services and infrastructure utilities (like Loggers and Notifiers) via Dependency Injection (`DictosProvider`). For the Dictionary view, it owns browse mode, entry mode, preview content, selection state, and context-menu targeting; clients provide the UI, input bindings, and platform-native Notification rendering.
- **Error Handling**: "Errors as values" using the `errore` package is preferred in almost every case. Return `ReturnType | ErrorType` unions. Only `throw` exceptions for truly exceptional circumstances, some exapmles include but not limited to: unrecoverable system errors, deep stack bubbling (e.g., global middleware catching low-level crashes), or violations of invariants/developer mistakes (e.g., out-of-bounds array access).
- **Testing**: Value over coverage. We favor testing against real boundaries (Integration Tests, local Turso server) over mocking internal infrastructure. See `docs/testing.md` for full strategy.
- **Logging**: The core domain is ignorant of logging. The presentation layer (`@dictos/react`) and adapters log execution outcomes using a generic `Logger` interface (`@dictos/logger`), fulfilled by concrete adapters (e.g., Pino) at the application composition root.
- **Developer Environment**: Declarative and reproducible environments via `devenv.sh`.
- **Secret Management**: Native `devenv` integration with `SecretSpec` for secure runtime injection. Secrets are never stored in global shell environments or committed.
- **Frontend/Clients**: OpenTUI with React bindings (for the TUI client), Commander.js (for the Command Client), a Vite Web client, and future Mobile clients. Each client should lean on its most natural input first, but the shared headless state is built to handle keyboard, mouse, touch, and context-menu interactions on every platform.
- **Backend**: Bun, ElysiaJS.
- **Database**: local libSQL (and Turso hosting), Drizzle ORM.
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
/packages/*-turso-sync/  # Platform-specific Turso DB clients (bun, wasm)
/packages/*-storage/     # Platform-specific local storage adapters (fs, local-storage)
/packages/eden-http/     # Elysia Eden HTTP client adapter
/packages/pino-logger/   # Pino-based logger adapter implementation
/packages/logger/        # Shared generic Logger interface port
```

## Domain Modules

- **Dictionary Management**: Core domain handling `Entries`, `Descriptions`, `Folders`, and basic `Activity` tracking. See: [Documentation Module - Dictionary Management](./modules/dictionary-management/domain.md)
- **LLM Generation**: Manages reusable `Instructions` and the generation of `Descriptions` via the Gemini API.
- **Import/Export**: Handles ingesting raw text from various sources and `Export` of data (e.g., to Anki, JSON).
- **Sync**: Handles the rules and conflict resolution for the bidirectional replication of private local data across a single user's devices. See: [Documentation Module - Sync](./modules/sync/domain.md)
- **Social**: Handles `Mirroring` of data to the central server for public viewing and socialization features.
