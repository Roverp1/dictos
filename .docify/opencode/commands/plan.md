---
description: Create the technical blueprint (plan.md) for a feature specification.
handoffs:
  - label: Generate Tasks
    agent: docify.tasks
    prompt: Break this plan down into actionable tasks.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Determine _how_ to build the feature technically, establishing data models and interface contracts before coding begins.

## Execution Steps

1. **Context Load**: Derive the target feature from the user input or context (if ambiguous among multiple active features, ask the user). Read the target feature's `spec.md` and the current `docs/system-overview.md`.

2. **Template Instantiation**: Copy the template from `.docify/templates/specification/plan-template.md` to the target feature's directory as `plan.md` using shell commands (e.g., `cp`).

3. **Micro-Grilling**: Activate the `grill-docify` skill in **technical** perspective to resolve database schemas, API contracts, and trade-offs. Write ADRs when appropriate.

4. **Draft the Plan**: Modify the copied template:
   - **Architectural Strategy**: Write a narrative explanation of the chosen approach and _why_ it was chosen over alternatives.
   - **Data Model Changes**: Explicitly define new tables, entities, or state changes.
   - **Interface Contracts**: Define the exact endpoints, ports, or service methods required.
   - Remove all instructional HTML comments (like `<!-- ACTION REQUIRED -->`) from copied files.

5. **Report**: Inform the user that the technical plan is ready and suggest running `/docify.tasks`.
