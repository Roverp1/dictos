# System Overview: [PROJECT_NAME]

**Last Updated**: [DATE] | **Version**: [VERSION]

<!--
  ACTION REQUIRED: This document is the primary entry point for understanding the system.
  When new features are absorbed, this document must be updated to reflect the new reality.
-->

## Project Purpose

[Describe what the application does in 2-3 sentences. e.g., "Dictos is a local-first multiplatform dictionary app designed for capturing and managing definitions, featuring cloud synchronization and social capabilities."]

## High-Level Architecture

[Brief explanation of the system. e.g., "The project uses a monorepo structure. Clients (like the TUI) interact with a core domain using Hexagonal Architecture. Data is persisted locally via Turso (libSQL) and synchronized with an ElysiaJS central backend."]

## Tech Stack & Project Rules (The Constitution)

<!--
  CRITICAL FOR AGENTS: This section acts as the Constitution for AI agents.
  List the non-negotiable tools, architectural conventions, and strict rules here.
  Agents must never violate these rules when planning or implementing features.
-->

- **Architecture**: Hexagonal Architecture. Core domain logic (`packages/core`) MUST NOT depend on external libraries, frameworks, or DB drivers.
- **Frontend/Clients**: [e.g., OpenTUI for TUI, React Native for mobile]
- **Backend**: [e.g., ElysiaJS, Bun]
- **Database**: [e.g., Turso / libSQL, Drizzle ORM]
- **Glossary**: See `CONTEXT.md` for strict domain terminology.

## Codebase Map

<!--
  ACTION REQUIRED: Replace the tree below with the concrete layout of the monorepo.
-->

```text
[ACTUAL_DIRECTORY_STRUCTURE]
# Example for Dictos:
# /apps/tui/          # Terminal UI client
# /apps/server/       # ElysiaJS central backend
# /packages/core/     # Pure domain entities, ports, and services
# /packages/adapters/ # Concrete implementations (DB, HTTP, Console)
```

## Domain Modules

<!--
  ACTION REQUIRED: List the functional domains of the system here.
  Complex domains MUST describe shortly their purpose and link to a dedicated Documentation Module folder in `/docs/modules/`.
-->

- **[DOMAIN_1_NAME]**: [Description if simple]
- **[DOMAIN_2_NAME]**: [Brief inline description. See: Documentation Module - [DOMAIN_2_NAME]](./modules/[DOMAIN_2_SLUG]/domain.md)
