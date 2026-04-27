---
date: April 2026
title: "Introduction and Goals"
---

# Introduction and Goals

## Overview

Dictos is a local-first text processing app for turning raw reading fragments into structured study material.

This doc set is the architecture view for Dictos. The SRS is the requirement source; these markdown files explain how the system should be shaped so Release 1 can grow into V2 and V3 without repainting everything from scratch.

Core idea:

- local-first by default
- platform-agnostic core domain
- thin adapters for TUI, storage, LLM access, and later mobile/web/gui clients
- no hard tie between domain logic and any one UI or platform

## Requirements Overview {#\_requirements_overview}

Dictos handles these main jobs in Release 1:

- capture raw text from TXT files and ReadEra backups
- create, edit, move, copy, and delete captures in nested directories
- store multiple definitions per capture
- generate definitions with Gemini using saved or temporary prompts
- export local data to Anki decks and JSON
- keep all core data local and usable offline
- provide everything through a keyboard-driven TUI

Roadmap pressure from later releases:

- V2 adds user accounts, cross-device sync, shared data, and social features
- V3 adds mobile capture and mobile access to core workflows
- the architecture must keep core domain logic reusable across these later platforms

Primary source:

- `software-requirements-specification-ieee-830/`

## Quality Goals {#\_quality_goals}

Top quality goals for Dictos:

1. Local sovereignty

- User data stays on device in V1.
- Core workflows must work offline.
- External services are optional, not a hard dependency for basic use.

2. Portability

- Core logic must not depend on TUI, Gemini, libSQL, or any specific runtime edge.
- Future mobile, web, and GUI clients should reuse the same domain and service layer.

3. Maintainability

- Keep business rules isolated from adapters.
- Add new interfaces without rewriting the core.
- Prefer explicit module boundaries over one tangled app blob.

4. Fast keyboard workflow

- TUI use must stay quick and low-friction.
- Editing, importing, and definition generation should feel immediate.

5. Reliability

- Local writes must survive crashes and power loss through transactional storage.
- Failed LLM requests must not corrupt local data.

## Stakeholders {#\_stakeholders}

| Role/Name           | Contact                                          | Expectations                                                             |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Solo developer      | You                                              | Keep architecture simple now, but not dumb. V1 must not block V2/V3.     |
| Academic evaluator  | Course review                                    | Clear requirements traceability, sound architecture, and readable docs.  |
| Future contributors | Unknown                                          | Separate modules, obvious boundaries, and docs that explain intent fast. |
| Future users        | Language learners, developers, local-first users | Fast capture workflow, offline core, and no cloud hostage game.          |

Related SRS: `01-introduction.typ`, `02-overall-description.typ`, `04-prioritization.typ`

Next: [Architecture Constraints and Context](context-constraints.md)
