---
description: Initialize the project documentation by grilling the user and generating the initial System Overview and CONTEXT.md.
handoffs:
  - label: Discuss a feature
    agent: docify.grill
    prompt: I want to build...
---

## User Input

```text
$ARGUMENTS
```

## Goal

Initialize the documentation architecture for this project.

## Execution Steps

1. **The Grilling Phase**: Interview the user relentlessly about the core purpose of the project, the non-negotiable tech stack, and the major domain boundaries. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.
   - Ask questions one at a time, waiting for feedback on each question before continuing.
   - Provide your recommended answer for each question.
   - Challenge fuzzy language. If the user uses vague terms, propose a precise canonical term.

2. **Establish Context**: Once the core concepts are clear, create or update `CONTEXT.md` at the project root using the established terminology format (Documentation, Specification, System Overview, Documentation Module). Capture any project-specific domain terms discussed.

3. **Generate System Overview**:
   - Copy the template from `.docify/templates/documentation/system-overview.md` to `docs/system-overview.md` using shell commands (e.g., `cp`).
   - Fill in the Project Purpose, High-Level Architecture, Tech Stack, Codebase Map, and Domain Modules based on the grilling session (ask additional questions if you detect any missing infromation).
   - Remove all instructional HTML comments (like `<!-- ACTION REQUIRED -->`) from the copied file.

4. **Handoff**: When complete, ask the user if they want to start exploring their first feature using `/docify.grill`.
