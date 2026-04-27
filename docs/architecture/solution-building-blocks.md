---
date: April 2026
title: "Solution Strategy and Building Block View"
---

# Solution Strategy

Dictos uses a local-first, modular monorepo architecture.

Main strategy:

- keep domain rules in a platform-agnostic core
- keep app orchestration in a separate service layer
- keep TUI, storage, LLM, and future platform UIs as adapters
- let V1 prove the core, while V2 and V3 reuse it instead of cloning it

This is not a fat-client app with some helpers around it. The whole point is to avoid that trap.

## Architectural Decisions

| Decision               | Why                                                                            |
| ---------------------- | ------------------------------------------------------------------------------ |
| Local-first V1         | Core use must work offline and keep user data on device.                       |
| Modular monorepo       | Future mobile, web, and GUI clients need shared core logic.                    |
| TypeScript everywhere  | One language across core, services, and adapters lowers friction.              |
| Bun runtime/tooling    | Fast local dev loop and simple project tooling.                                |
| OpenTUI UI layer       | Keyboard-driven terminal workflow fits V1 and quick capture work.              |
| libSQL persistence     | Local transactional store for captures, prompts, definitions, and directories. |
| Gemini adapter at edge | LLM use stays outside core so it can be swapped later.                         |

## Structure

Planned module split:

- `core/domain` - pure entities, value objects, rules, and invariants
- `core/application` - use cases and orchestration services
- `adapters/tui` - OpenTUI + React bindings
- `adapters/libsql` - local libSQL repositories
- `adapters/gemini` - Gemini request adapter
- `adapters/import-export` - TXT, ReadEra, Anki, JSON handling
- `platform/mobile` - future mobile client on shared core
- `platform/web` - future web client on shared core
- `platform/gui` - future desktop GUI client on shared core

Core rule:

- no adapter imports inside domain code
- no direct DB/API calls from UI code
- use ports at the core boundary

# Building Block View {#section-building-block-view}

## Whitebox Overall System {#\_whitebox_overall_system}

Dictos splits into a small core and several edges.

### Level 1 Blocks

| Name                     | Responsibility                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| Domain Core              | Own capture, definition, directory, prompt, and validation rules. |
| Application Services     | Execute use cases and coordinate ports.                           |
| TUI Adapter              | Present keyboard workflow and send actions to services.           |
| Persistence Adapter      | Store and load local data in libSQL.                              |
| LLM Adapter              | Send prompt and capture text to Gemini and return results.        |
| Import/Export Adapter    | Parse TXT/ReadEra and produce Anki/JSON exports.                  |
| Future Platform Adapters | Reuse same core from mobile, web, or GUI later.                   |

### Core Relations

- TUI calls application services
- services call ports, not concrete adapters
- domain core stays free of UI, network, and DB details
- persistence adapter owns libSQL schema access
- LLM adapter owns Gemini communication
- import/export adapter owns file format specifics

### Important Interfaces

- `CaptureRepository`
- `DefinitionRepository`
- `DirectoryRepository`
- `PromptRepository`
- `LlmPort`
- `ImportPort`
- `ExportPort`

These ports are the seam. They keep V1 stable and V2/V3 possible.

## Level 2

### Domain Core

Purpose:

- model local dictionary data and rules

Contains:

- Capture
- Definition
- Directory
- Prompt
- local activity aggregate for later stats/sync

Responsibilities:

- validate capture text
- keep directory nesting sane
- handle one-to-many capture to definition relation
- preserve local-first invariants

### Application Services

Purpose:

- run use cases end to end

Contains:

- CaptureService
- DirectoryService
- PromptService
- DefinitionService
- ImportService

Responsibilities:

- coordinate validation, storage, and adapter calls
- keep orchestration out of UI
- retry transient LLM failures up to 3 times
- support bulk definition generation

### TUI Adapter

Purpose:

- expose capture/edit/import/generate/export workflows in terminal

Responsibilities:

- render two-pane workflow
- support in-place editing
- show prompt picker for one or many captures
- keep UI responsive while requests run

### Persistence Adapter

Purpose:

- own libSQL persistence details

Responsibilities:

- transactions
- schema mapping
- query performance
- local-only storage for V1

### LLM Adapter

Purpose:

- isolate Gemini calls

Responsibilities:

- send HTTPS requests
- normalize prompt/capture input
- return generated definition text
- report transient failures cleanly

### Import/Export Adapter

Purpose:

- handle file boundaries

Responsibilities:

- parse TXT and ReadEra backups
- export to Anki and JSON
- keep file format junk out of core

## Level 3

Likely deeper splits later:

- `core/domain/capture`
- `core/domain/directory`
- `core/domain/prompt`
- `core/domain/definition`
- `core/application/import`
- `core/application/definition-generation`
- `adapters/libsql/schema`
- `adapters/tui/screens`
- `adapters/gemini/client`

Do not split these too early unless code pressure says so. Keep it boring until it hurts.

Related SRS: `02-overall-description.typ`, `03-specific-requirements.typ`, `05-appendices.typ`

Next: [Runtime and Deployment View](runtime-deployment.md)
