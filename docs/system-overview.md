# System Overview: Dictos

**Last Updated**: May 24, 2026 | **Version**: 1.0.0-draft

## Project Purpose

Dictos is a local-first, application for building and managing personal dictionaries. It allows users to capture text fragments (Entries) from digital reading, organize them into Folders, generate LLM-powered explanations (Descriptions) using reusable templates (Instructions), and export the data for spaced-repetition study (e.g., Anki). While the initial client is a Terminal UI, Dictos is designed as a cross-platform system that is also implementing a Mobile (React Native) client, with Web platforms planned for the future.

## High-Level Architecture

The project uses a monorepo structure. It employs Hexagonal Architecture to isolate core business logic and React state from specific rendering environments or infrastructure. This separation allows the core logic to be shared across the current TUI and future Mobile/Web clients. Data is persisted locally via libSQL, and cross-device synchronization will be handled via native libSQL push/pull features utilizing Turso hosting. The central ElysiaJS will handle social features and data mirroring required for these social features.

## Tech Stack & Project Rules (The Constitution)

- **Architecture**: Hexagonal Architecture. Core domain logic (`packages/core`) MUST NOT depend on external libraries, frameworks, or DB drivers. Core React logic must remain independent of rendering layers.
- **Error Handling**: "Errors as values" using the `errore` package is preferred in almost every case. Return `ReturnType | ErrorType` unions. Only `throw` exceptions for truly exceptional circumstances, some exapmles include but not limited to: unrecoverable system errors, deep stack bubbling (e.g., global middleware catching low-level crashes), or violations of invariants/developer mistakes (e.g., out-of-bounds array access).
- **Frontend/Clients**: OpenTUI with React bindings (for the TUI client). Web and Mobile clients planned for future phases.
- **Backend**: Bun, ElysiaJS.
- **Database**: local libSQL (and Turso hosting), Drizzle ORM.
- **Glossary**: See `CONTEXT.md` for strict domain terminology.

## Codebase Map

```text
/apps/tui/          # Terminal UI client (OpenTUI + React bindings)
/apps/server/       # ElysiaJS central backend for sync & social features
/packages/core/     # Pure domain entities, ports, and services
/packages/adapters/ # Concrete implementations (libSQL DB, HTTP, etc.)
```

## Domain Modules

- **Dictionary Management**: Core domain handling `Entries`, `Descriptions`, `Folders`, and basic `Activity` tracking. See: [Documentation Module - Dictionary Management](./modules/dictionary-management/domain.md)
- **LLM Generation**: Manages reusable `Instructions` and the generation of `Descriptions` via the Gemini API.
- **Import/Export**: Handles ingesting raw text from various sources and `Export` of data (e.g., to Anki, JSON).
- **Sync**: Handles the rules and conflict resolution for the bidirectional replication of private local data across a single user's devices. See: [Documentation Module - Sync](./modules/sync/domain.md)
- **Social**: Handles `Mirroring` of data to the central server for public viewing and socialization features.
