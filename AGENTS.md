# Agent Instructions for Dictos

This is a **Bun + Turborepo** monorepo building a local-first application with cross-platform clients.

## Architecture & Code Constraints

> **CRITICAL**: For any large features, structural changes, or if you are unsure about the domain, you MUST read `docs/system-overview.md` and `CONTEXT.md` before proceeding.

- **Hexagonal Architecture**: Core domain logic lives in `packages/core`. It **MUST NOT** depend on external libraries, React, UI frameworks, or database drivers. Use Dependency Injection (ports/adapters).
- **Headless UI**: `@dictos/react` acts as a headless controller for React state and actions. It is shared across TUI and Web clients.
- **Error Handling**: Follow "errors as values" using the `errore` package (return `ReturnType | ErrorType` unions). **Do not use `throw` or `try/catch`** unless dealing with unrecoverable crashes. Always activate `errore` skill.
- **Strict Terminology**: Refer to `CONTEXT.md` for strict domain vocabulary (e.g., "Entry", "Description", "Folder"). Do not invent synonyms.

## Important Commands

- **Install dependencies**: `bun install`
- **Typecheck all packages**: `bun run typecheck`
- **Run TUI client**: `bun run dev:tui`
- **Run Web client**: `bun run dev:web`
- **Run Central Server**: `bun run dev:server`

## Tech Stack Quirks

- **Database**: Local `Turso` database (formerly Limbo) and Turso Cloud (Activate `turso-db` skill when working with database). Shared schema is in `packages/db-core` using `Drizzle ORM`.
- **Backend**: `ElysiaJS` (running on Bun) (Activate `elysiajs` skill when working on `apps/server`).
- **UI Clients**: The terminal UI uses `OpenTUI` with React bindings (Activate `opentui` skill when working on `apps/tui`). The web SPA uses `Vite` and `React Router` as a library.
- **Logging**: Domain logic does not log. UI and adapters use a generic `Logger` port (`@dictos/logger`), typically fulfilled by `pino`.
