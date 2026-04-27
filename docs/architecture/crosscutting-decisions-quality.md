---
date: April 2026
title: "Cross-cutting Concepts, Decisions and Quality"
---

# Cross-cutting Concepts {#section-concepts}

## Local-first data flow

- local store is primary source of truth in V1
- external services enrich data, not own it
- offline mode must still allow core capture management

## Port and adapter boundaries

- domain and services depend on interfaces
- adapters depend on concrete tech
- UI never talks directly to DB or Gemini

## Prompt management

- prompts are reusable user-managed assets
- users may use temporary prompts without saving them
- prompt storage stays local in V1

## Directory hierarchy

- captures live in nested directories
- directory tree is primary organization model
- move/copy/delete operations must preserve integrity

## LLM execution model

- Gemini calls are async from UI perspective
- transient failures retry up to 3 times
- request logic stays outside domain core

## Future platform reuse

- mobile, web, and GUI clients reuse same core use cases
- platform-specific behavior stays in adapters
- sync and auth added later without rewriting dictionary logic

# Architecture Decisions {#section-design-decisions}

| Decision                          | Rationale                                                       |
| --------------------------------- | --------------------------------------------------------------- |
| Keep V1 local-first               | Protect offline use and local data ownership.                   |
| Split core from adapters          | Keep future platforms from cloning logic.                       |
| Use libSQL locally                | Need transactional local persistence with a path to sync later. |
| Use OpenTUI + React bindings      | Fast terminal workflow and keyboard control.                    |
| Keep Gemini behind a port         | LLM vendor lock-in would be stupid here.                        |
| Model prompts as first-class data | Prompt reuse is part of the workflow, not a side note.          |

## Quality Requirements {#section-quality-scenarios}

### Quality Requirements Overview {#\_quality_requirements_overview}

| Quality            | Requirement                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| Offline capability | Core operations work without internet.                                                 |
| Performance        | Local DB ops under 50ms, interactive app start under 1 second, LLM calls non-blocking. |
| Maintainability    | Core logic isolated from platform tech.                                                |
| Portability        | Core can feed mobile, web/gui, and later sync.                                         |
| Reliability        | Transactions protect local data on crash or power loss.                                |
| Security           | External communication uses HTTPS; later auth must stay cross-platform friendly.       |

### Quality Scenarios {#\_quality_scenarios}

| Scenario              | Context                         | Stimulus                             | Response                                             | Measure                             |
| --------------------- | ------------------------------- | ------------------------------------ | ---------------------------------------------------- | ----------------------------------- |
| Offline capture edit  | User on laptop with no network  | User edits or creates capture        | App works normally                                   | No network dependency for core flow |
| Fast local lookup     | Large local dataset             | User opens directory or capture list | View renders quickly                                 | Local DB access under 50ms          |
| Definition generation | User selects capture and prompt | Gemini request starts                | UI stays responsive and retries on transient failure | No UI freeze; up to 3 retries       |
| Future sync           | V2 client on another device     | User triggers sync                   | Shared data updates through backend                  | Data converges across devices       |

Related SRS: `02-overall-description.typ`, `03-specific-requirements.typ`, `04-prioritization.typ`

Next: [Risks, Technical Debt and Glossary](risks-glossary.md)
