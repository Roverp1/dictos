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

2. **Template Instantiation**: Copy the content from `.docify/templates/specification/plan-template.md` to the target feature's directory as `plan.md`.

3. **Micro-Grilling (Just-in-Time Resolution)**: As you map out the technical architecture, database schemas, and API contracts, you will likely hit low-level unknowns (e.g., "Should this be a soft delete?", "Do we need an index here?", "What HTTP status code is best?").
   - **DO NOT guess, hallucinate, or leave placeholders.**
   - Stop and "grill" the user on this specific technical micro-decision in the chat.
   - Act as a senior engineer: propose a strong recommendation, explain the trade-offs, and ask for their input (e.g., "For the Outbox table, I recommend a 'processed_at' nullable timestamp instead of deleting the row, so we have an audit log. Do you agree?").
   - Reach an agreement in the chat, then write the final decision into the plan.

4. **Draft the Plan**: Modify the copied template:
   - **Architectural Strategy**: Write a narrative explanation of the chosen approach and _why_ it was chosen over alternatives.
   - **Data Model Changes**: Explicitly define new tables, entities, or state changes.
   - **Interface Contracts**: Define the exact endpoints, ports, or service methods required.

5. **Report**: Inform the user that the technical plan is ready and suggest running `/docify.tasks`.
