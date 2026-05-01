---
date: April 2026
title: "Solution Strategy and Building Block View"
---

# Solution Strategy

Dictos follows local-first hexagonal monorepo architecture.

Main strategy:

- keep the application core independent from UI, persistence, and external services
- let inbound adapters drive the core through ports
- let outbound adapters implement ports declared by the core

This is not a UI app with a few helper modules. The center is the system. Everything else is replaceable.

## Architectural Decisions

| Decision              | Why                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Local-first           | Core features must work offline, to keep user's data private, and not depend on the internet connection |
| Hexagonal core        | Business rules stay isolated from frameworks and infrastructure.                                        |
| TypeScript everywhere | One language across core and adapters lowers friction.                                                  |
| Bun runtime/tooling   | Fast local dev loop and simple project tooling.                                                         |
| OpenTUI UI layer      | Keyboard-driven terminal workflow fits the first capture slice.                                         |
| libSQL persistence    | Local transactional store for captures and other local records.                                         |
| Thin adapters         | UI, storage, and external services stay outside the core.                                               |

## Structure

Planned module split:

- `packages/core` - domain model and port interfaces
- `packages/adapters` - concrete outbound adapters like persistence and future integrations
- `apps/tui` - inbound adapter for terminal interaction
- `apps/web` - future inbound adapter for browser interaction
- `apps/backend` - future inbound adapter for API interaction
- `apps/mobile` - future inbound adapter for mobile interaction
- `apps/gui` - future inbound adapter for desktop interaction

Core rule:

- no adapter imports inside core code
- no direct DB/API calls from app code when a port already exists
- adapters depend on the core, not the other way around

# Building Block View {#section-building-block-view}

## Whitebox Overall System {#\_whitebox_overall_system}

Dictos splits into a hexagonal core and outer adapters.

### Level 1 Blocks

| Name                | Responsibility                                                  |
| ------------------- | --------------------------------------------------------------- |
| Core                | Own domain rules and port interfaces.                           |
| TUI adapter         | Translate keyboard actions into core calls.                     |
| Persistence adapter | Implement storage ports with libSQL.                            |
| Future adapters     | Add other input or output technologies while keeping core pure. |

### Core Relations

- inbound adapters call the core through input ports
- the core owns the decision logic
- the core calls output ports, never concrete adapters
- outbound adapters handle libSQL, file system, or other external concerns

### Important Interfaces

- inbound port for capture actions
- outbound port for capture persistence

These ports are the seam. They keep the core stable while adapters change.

## Level 2

### Core

Purpose:

- hold the business rules and port contracts

Contains:

- capture model
- input port for capture workflows
- output port for capture storage
- validation and coordination logic around the capture flow

Responsibilities:

- validate capture text
- preserve core invariants
- decide what data is acceptable before persistence
- stay ignorant of TUI, libSQL, or any other concrete adapter

### Inbound Adapter: TUI

Purpose:

- let the user create and inspect captures from the terminal

Responsibilities:

- render terminal screens
- collect user input
- call the core through inbound ports
- present success and failure states

### Outbound Adapter: Persistence

Purpose:

- store and load captures locally

Responsibilities:

- map core objects to storage records
- execute libSQL operations
- handle transactions and schema details
- keep database details out of the core

## Level 3

Likely deeper splits later:

- `packages/core/src/capture`
- `packages/core/src/ports/in`
- `packages/core/src/ports/out`
- `packages/adapters/libsql/src`
- `apps/tui/src`

Do not split these too early unless code pressure says so. Keep it boring until it hurts.

Related SRS: `02-overall-description.typ`, `03-specific-requirements.typ`, `05-appendices.typ`

Next: [Runtime and Deployment View](runtime-deployment.md)
