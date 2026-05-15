<!--
Sync Impact Report:
- Version change: 0.0.0 → 1.0.0 (Initial Creation)
- Added sections: Core Principles, Technology Stack and Constraints, Development Workflow, Governance
- Removed sections: N/A
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md
  ✅ .specify/templates/spec-template.md
  ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: N/A
-->

# Dictos Constitution

## Core Principles

### I. Local Sovereignty

Core workflows MUST function offline. External services (like Gemini) MUST be treated as optional enhancements, not hard dependencies for basic use.

### II. Portability via Hexagonal Architecture

Core logic MUST NOT depend on the TUI, Gemini API, libSQL, or any specific runtime environment. Future mobile, web, and GUI clients MUST be able to reuse the same core domain and ports without modification.

## Technology Stack and Constraints

The application MUST be built using OpenTUI with React bindings for the terminal interface and libSQL for local data persistence. Communication with external APIs (Gemini) MUST be done via HTTPS. The architecture MUST adhere strictly to Hexagonal Architecture principles to support future extensions like React Native mobile apps or cloud sync.

## Development Workflow

Adapter implementations MUST be kept separate from the `core/` package, adhering to the established monorepo structure.

## Governance

This Constitution supersedes all other practices and guides architectural decisions. Any PR or feature implementation MUST verify compliance with the Hexagonal Architecture and Local-First constraints. Violations of core domain isolation MUST be rejected.

**Version**: 1.0.0 | **Ratified**: 2026-05-15 | **Last Amended**: 2026-05-15
