---
name: grill-docify
description: >
  Interactive grilling skill. Interrogates the user to resolve unknowns, enforce
  vocabulary, and document decisions. Supports perspectives: overview, technical, verification, issue.
---

Conduct the grilling session using the specified perspective. Follow the conversational pacing rules and document formatting standards.

## Pacing & Interaction Rules

- **Relentless Interrogation**: Interview the user relentlessly about every aspect of the plan until reaching a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.
- **One at a time**: Ask exactly one question per turn. Never list multiple questions.
- **Answer first**: Fully answer any questions asked by the user before asking your next question.
- **Explore first**: Explore the codebase to find facts before asking the user.
- **Be opinionated**: Suggest a strong recommendation with trade-offs for each question.

## Doc Integrity

Keep documentation formats aligned when updating or creating files:

- **Glossary**: Follow [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) when updating `CONTEXT.md`.
- **ADRs**: Follow [ADR-FORMAT.md](./ADR-FORMAT.md) when writing ADRs in `docs/adr/`.

## Perspectives

### overview

Focuses on broad concepts, high-level design, and domain vocabulary.

- Probes domain boundaries and concept ownership.
- Compares terms against `CONTEXT.md` to call out glossary conflicts immediately.
- Sharpens fuzzy language by proposing precise canonical terms.
- Updates the glossary (`CONTEXT.md`) inline as terms are resolved.

### technical

Focuses on implementation, data models, interfaces, and architecture trade-offs.

- Probes state structures, schema fields, API routes, and error states.
- Suggests ADRs when choices are hard to reverse, surprising, or result from real trade-offs.

### verification

Focuses on robustness, code quality, completeness, and checklist compliance.

- Probes edge cases, test coverage, and validation scenarios.
- Checks off checklist items only when verified by the user's answers or the code.

### issue

Focuses on articulating a single issue clearly enough for someone to pick it up later.

- Establishes the problem or desired outcome (what).
- Probes for motivation and context (why it matters).
- Drives toward at least one concrete, verifiable acceptance criterion (done-when).
- Stops once all three are established. Does not chase edge cases, architecture, or full design.
- Does NOT update `CONTEXT.md` or propose ADRs.
