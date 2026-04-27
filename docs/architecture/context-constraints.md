---
date: April 2026
title: "Architecture Constraints and Context"
---

# Architecture Constraints

Dictos architecture is constrained by these hard rules:

- V1 must be local-first and usable offline
- core domain must stay platform-agnostic
- TUI must use OpenTUI with React bindings
- implementation language is TypeScript
- runtime and tooling use Bun
- local persistence uses libSQL
- LLM generation uses Gemini in V1
- later V2/V3 platforms must be able to reuse core logic
- future auth should stay cross-platform friendly, likely JWT or another token-based mechanism

Architectural consequence:

- do not put business rules inside UI code
- do not bind core domain to libSQL, Gemini, or terminal-only abstractions
- treat adapters as disposable edges

## Context and Scope {#section-context-and-scope}

Dictos is a personal dictionary builder. It sits between reading sources and study tools.

### Business Context {#\_business_context}

| Communication partner | Input                                             | Output                                      |
| --------------------- | ------------------------------------------------- | ------------------------------------------- |
| User                  | Raw text, edits, prompt choice, directory actions | Captures, definitions, exports, feedback    |
| ReadEra backup file   | Notes and captured text                           | Imported captures                           |
| TXT file              | Raw text                                          | Imported captures                           |
| Gemini API            | Capture text plus prompt                          | Generated definition text                   |
| Anki                  | Export package or JSON-fed import flow            | Study decks                                 |
| Future sync backend   | Local data and change sets                        | Synced account/device state                 |
| Future mobile client  | Shared core actions                               | Captures, definitions, directory operations |
| Future web/gui client | Shared core actions                               | Same domain behavior through another UI     |

### Technical Context {#\_technical_context}

| Channel                         | Used for                 | Notes                                                                                          |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| Local terminal UI               | V1 interaction           | OpenTUI with React bindings                                                                    |
| Local libSQL store              | Persistence              | Offline-first storage for captures, definitions, prompts, directories, and activity aggregates |
| HTTPS to Gemini                 | Definition generation    | Requires internet and user API key                                                             |
| Local file system               | Import/export            | TXT, ReadEra backups, Anki, JSON                                                               |
| Future HTTPS sync channel       | Cross-device sync        | Planned for V2                                                                                 |
| Future token-based auth channel | Account/session handling | JWT or another cross-platform friendly auth mechanism                                          |

Related SRS: `03-specific-requirements.typ`, `04-prioritization.typ`

Next: [Solution Strategy and Building Block View](solution-building-blocks.md)
