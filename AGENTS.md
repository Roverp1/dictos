# Agent Instructions for Dictos

This is a **Bun + Turborepo** monorepo building a local-first application with cross-platform clients.

## Architecture & Code Constraints

> **CRITICAL**: For any large features, structural changes, or if you are unsure about the domain, you MUST read `docs/system-overview.md` and `CONTEXT.md` before proceeding.

Before changing a package's dependencies, test runner, build tooling, or runtime assumptions, or reviewing package changes, read the nearest `AGENTS.md` and package `README.md`. Review agents must include those files as standards sources. Package-specific instructions override generic repository guidance. If the documents still conflict, stop and ask instead of guessing.

- **Hexagonal Architecture**: Core domain logic lives in `packages/core`. It **MUST NOT** depend on external libraries, React, UI frameworks, or database drivers. Use Dependency Injection (ports/adapters).
- **Headless UI**: `@dictos/react` acts as a headless controller for React state and actions. It is shared across TUI and Web clients.
- **Error Handling**: Follow "errors as values" using the `errore` package (return `ReturnType | ErrorType` unions). **Do not use `throw` or `try/catch`** unless dealing with unrecoverable crashes. Always activate `errore` skill.
- **Strict Terminology**: Refer to `CONTEXT.md` for strict domain vocabulary (e.g., "Entry", "Description", "Folder"). Do not invent synonyms.

## Feature Specifications

Feature specs record the intent and known constraints at planning time, not an immutable implementation checklist. Follow them as a starting point, but adapt when implementation reveals necessary work. Explain material deviations and their impact in the PR, verify the resulting behavior, and update living documentation when contracts change. In reviews, investigate unexplained changes and unmet requirements; do not treat a change as defective solely because the spec did not anticipate it. Call out unverified risks rather than claiming they passed.

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
