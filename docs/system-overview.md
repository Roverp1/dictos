# System Overview: Dictos

**Last Updated**: Sep 29, 2026 | **Version**: 1.0.0-draft

## Project Purpose

Dictos is a local-first application for building and managing personal dictionaries. It allows users to save Entries from digital reading, organize them into Folders, group typed Descriptions under Senses, generate Descriptions with reusable Instructions, and export Dictionary data for spaced-repetition study. The Terminal UI and Command Client are the current clients. The Web client is retained but broken and unmaintained; Mobile is planned for the future.

## High-Level Architecture

The monorepo uses Hexagonal Architecture to keep core business logic and headless React state independent of rendering environments and infrastructure. The TUI uses the shared Dictionary interaction model. The retained Web client was built around it but is broken and unmaintained; future Mobile clients may also use it. A local Turso SQLite-compatible database stores Dictionary data, with Turso push/pull handling cross-device synchronization. The central ElysiaJS server handles authentication and will support social features and the data Mirroring they require.

Description Generation follows the same boundaries. `packages/core` validates Model eligibility and builds an in-memory proposal without depending on an AI library. The Command Client calls the selected Provider directly through `@dictos/ai-sdk`, handles duplicate confirmation, and commits an accepted proposal atomically through `@dictos/db-core`. Provider Connections and the Selected Model stay outside the Dictionary database in device-local filesystem storage; the central server is not part of the generation path. Provider setup, Model browsing and selection, and Description Generation are currently available only through the Command Client, not the TUI or Web client.

The Model Catalog lists eligible text-generation Models from a bundled models.dev snapshot or a validated device-local cache, with an explicit CLI refresh to update the cache. A shared eligibility check excludes embedding-only Models that models.dev also describes as text-capable; old caches without that check fall back to the bundled snapshot. Ordinary listing works offline and does not probe Providers' `/models` endpoints. Catalog entries are metadata, not proof of account access or trusted instructions for routing requests. `@dictos/ai-sdk` supports the fixed Provider IDs `openai`, `google`, `openrouter`, `deepseek`, and `groq`: native AI SDK adapters for OpenAI and Google, and fixed OpenAI-compatible routes for OpenRouter, DeepSeek, and Groq. New catalog Models can become selectable after refresh, but adding a Provider or changing its endpoint requires a reviewed code change.

## Tech Stack & Project Rules (The Constitution)

- **Architecture**: Clean / Hexagonal Architecture. Core domain logic (`packages/core`) MUST NOT depend on external libraries, frameworks, or DB drivers.
- **Interface Adapters**: The `@dictos/react` package acts as a headless controller, exposing shared state and intent actions while receiving domain services and infrastructure utilities (like Loggers and Notifiers) via Dependency Injection (`DictosProvider`). For the Dictionary view, it owns browse mode, entry mode, preview content, selection state, and context-menu targeting; clients provide the UI, input bindings, and platform-native Notification rendering.
- **Error Handling**: "Errors as values" using the `errore` package is preferred in almost every case. Return `ReturnType | ErrorType` unions. Only `throw` exceptions for truly exceptional circumstances, some exapmles include but not limited to: unrecoverable system errors, deep stack bubbling (e.g., global middleware catching low-level crashes), or violations of invariants/developer mistakes (e.g., out-of-bounds array access).
- **Testing**: Value over coverage. We favor testing against real boundaries (Integration Tests, local Turso server) over mocking internal infrastructure. Root test/typecheck commands exclude browser workspaces; there are no active Web/browser E2E tests. See `docs/testing.md` for the current verification boundary.
- **Logging**: The core domain is ignorant of logging. The presentation layer (`@dictos/react`) and adapters log execution outcomes using a generic `Logger` interface (`@dictos/logger`), fulfilled by concrete adapters (e.g., Pino) at the application composition root.
- **Description Generation**: Vercel AI SDK is isolated behind core-owned ports in `@dictos/ai-sdk`. Generation is non-streaming through native OpenAI and Google or fixed OpenAI-compatible routes; expected SDK compatibility warnings and provider failures are sanitized before structured logging.
- **Developer Environment**: Declarative and reproducible environments via `devenv.sh`.
- **Secret Management**: Native `devenv` integration with `SecretSpec` for secure runtime injection. Secrets are never stored in global shell environments or committed.
- **Frontend/Clients**: OpenTUI with React bindings (for the TUI client), Commander.js (for the Command Client), a retained but unsupported Vite Web client, and future Mobile clients. The shared headless state is designed for keyboard, mouse, touch, and context-menu interactions across platforms.
- **Backend**: Bun, ElysiaJS.
- **Database**: Local Turso SQLite-compatible storage, Turso-hosted Sync, and Drizzle ORM.
- **Glossary**: See `CONTEXT.md` for strict domain terminology.

## Codebase Map

```text
/apps/tui/               # Terminal UI client (OpenTUI + React bindings)
/apps/cli/               # Command Client (Commander.js, script-oriented CLI)
/apps/web/               # Retained, unsupported Web client SPA (Vite + React Router)
/apps/server/            # ElysiaJS central backend for sync & social features
/packages/core/          # Pure domain entities, ports, and services
/packages/react/         # Headless shared UI logic, Dictionary state/actions, and provider wiring
/packages/db-core/       # Shared Drizzle schema, migrations, and generic repositories
/packages/ai-sdk/        # Fixed Provider routes, Description Generation, and models.dev Model Catalog adapter
/packages/*-turso-sync/  # Platform-specific Turso DB clients (Bun; retained browser/WASM adapter)
/packages/*-storage/     # Platform-specific local storage adapters (fs, local-storage)
/packages/eden-http/     # Elysia Eden HTTP client adapter
/packages/pino-logger/   # Pino-based logger adapter implementation
/packages/logger/        # Shared generic Logger interface port
```

## Domain Modules

- **Dictionary Management**: Core domain handling `Entries`, `Descriptions`, `Senses`, `Folders`, and basic `Activity` tracking. See: [Documentation Module - Dictionary Management](./modules/dictionary-management/domain.md)
- **Description Generation**: Manages reusable `Instructions`, device-local `Provider Connections`, a device-local `Selected Model`, the `Model Catalog`, and typed Description Generation. A qualified `provider/model` ID selects a catalog-eligible Model from a configured Provider; generation uses the Selected Model unless the command supplies a one-command override, and never picks one automatically. `packages/core` owns eligibility, selection, proposal, and validation rules; `@dictos/ai-sdk` owns the bundled/cached catalog and fixed Provider routes; `@dictos/db-core` owns atomic proposal persistence. `dictos provider`, `dictos models`, and `dictos model` use device-local storage without opening the Dictionary database; generation still needs it. These workflows are CLI-only for now. Credentials, catalog cache, and the Selected Model do not Sync or enter the central server. See: [Documentation Module - Description Generation](./modules/description-generation/domain.md)
- **Import/Export**: Handles ingesting raw text from various sources and `Export` of data (e.g., to Anki, JSON).
- **Sync**: Handles the rules and conflict resolution for the bidirectional replication of private local data across a single user's devices. See: [Documentation Module - Sync](./modules/sync/domain.md)
- **Social**: Handles `Mirroring` of data to the central server for public viewing and socialization features.
