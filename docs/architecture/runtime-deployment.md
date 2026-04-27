---
date: April 2026
title: "Runtime and Deployment View"
---

# Runtime View {#section-runtime-view}

## Runtime Scenarios

### 1. Manual capture entry

Source:

- user typing in TUI

Flow:

1. User opens capture screen.
2. TUI sends request to `CaptureService`.
3. Service validates capture text.
4. Service stores capture in local libSQL.
5. TUI refreshes view and shows saved item.

What matters:

- works offline
- keeps editing keyboard-driven
- stores data locally without external services

### 2. Import from TXT or ReadEra

Source:

- file chosen by user

Flow:

1. User selects import action.
2. TUI sends file path to `ImportService`.
3. Import adapter parses file format.
4. Parsed captures go through `CaptureService`.
5. Service stores each capture locally.
6. TUI reports success or import errors.

What matters:

- import is file-boundary logic, not core logic
- parser failures must not poison stored data

### 3. Generate definitions with Gemini

Source:

- user choosing one or many captures plus prompt

Flow:

1. User selects capture(s).
2. User picks saved prompt or enters temporary prompt.
3. TUI calls `DefinitionService` through application layer.
4. Service reads capture text and prompt from local store.
5. Service calls `LlmPort` through Gemini adapter.
6. Adapter sends HTTPS request to Gemini.
7. Service stores returned definition locally.
8. On temporary failure, service retries up to 3 times.
9. TUI shows success or failure and keeps UI moving.

What matters:

- LLM is optional dependency
- UI must not block hard while request runs
- failure must not break local data

### 4. Edit capture, definition, directory, or prompt

Source:

- user editing a selected row in place

Flow:

1. User starts edit command.
2. TUI swaps row into input mode.
3. User confirms or cancels.
4. Application service validates and persists if confirmed.
5. UI returns to list view.

What matters:

- low-friction terminal workflow
- editing stays close to selection state

### 5. Export to Anki or JSON

Source:

- user export action

Flow:

1. User picks export target.
2. Application service reads local data.
3. Export adapter converts records into output format.
4. File is written locally.

What matters:

- export is deterministic and local
- external study tool integration happens at file boundary

## Deployment View {#section-deployment-view}

### V1 Deployment

Dictos V1 runs as a single local application on user machine.

Nodes:

- terminal emulator
- Bun runtime
- TypeScript app
- local libSQL database file
- local file system for import/export
- remote Gemini API over HTTPS

### V1 Mapping

| Building block        | Deployed where                  |
| --------------------- | ------------------------------- |
| Domain Core           | Bun process, in memory          |
| Application Services  | Bun process, in memory          |
| TUI Adapter           | Terminal emulator               |
| Persistence Adapter   | Bun process + local libSQL file |
| LLM Adapter           | Bun process + HTTPS client      |
| Import/Export Adapter | Bun process + local file system |

### V2 Deployment

- local client remains on user device
- central server added for auth, sync, and shared data
- token-based auth layer, likely JWT or similar
- sync uses HTTPS between client and backend

### V3 Deployment

- mobile client added
- shared core logic reused by another adapter set
- platform-specific UI and share/select capture hooks added

Related SRS: `03-specific-requirements.typ`, `05-appendices.typ`

Next: [Cross-cutting Concepts, Decisions and Quality](crosscutting-decisions-quality.md)
