---
description: Break the technical plan down into an actionable, phased checklist (tasks.md).
---

## User Input

```text
$ARGUMENTS
```

## Goal

Create a granular, dependency-ordered execution checklist for the feature.

## Execution Steps

1. **Context Load**: Derive the target feature from the user input or context (if ambiguous among multiple active features, ask the user). Read the target feature's `plan.md` and `spec.md`.

2. **Template Instantiation**: Copy the template from `.docify/templates/specification/tasks-template.md` to the target feature's directory as `tasks.md` using shell commands (e.g., `cp`).

3. **Draft the Tasks**: Modify the copied template, breaking the work down into logical phases:
   - Phase 1: Foundation & Data Contracts (DB migrations, core types).
   - Phase 2: Core Logic & Interfaces.
   - Phase 3: UI & Integration.
   - Use `[P]` markers for parallelizable tasks.
   - Tag tasks with user stories (e.g., `[US1]`).
   - Remove all instructional HTML comments (like `<!-- ACTION REQUIRED -->`) from copied files.

4. **The Critical Phase**: You MUST ensure the final phase is always present and correctly populated:
   - **Phase N: Absorb into Documentation**
   - Include specific tasks to update `docs/system-overview.md` and any relevant `docs/modules/[domain]/` files based on the data models and contracts defined in the plan.

5. **Report**: Inform the user that the task list is ready for implementation.
