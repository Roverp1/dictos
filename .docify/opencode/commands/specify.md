---
description: Create the time-bound feature specification (spec.md) based on a finalized idea or grilling session.
handoffs:
  - label: Create Technical Plan
    agent: docify.plan
    prompt: Create the technical plan for this specification.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Translate the agreed-upon feature idea into a structured, human-readable specification.

## Execution Steps

1. **Generate Feature Name**: Create a concise short name (2-4 words) for the feature (e.g., `add-user-auth`). Create a directory `specs/00X-[short-name]/` (incrementing X based on existing folders in `specs/` and `specs/.archive`).

2. **Template Instantiation**: Copy the template from `.docify/templates/specification/spec-template.md` to `specs/00X-[short-name]/spec.md` using shell commands (e.g., `cp`).

3. **Micro-Grilling**: If you encounter product ambiguities during spec generation, activate the `grill-docify` skill in **technical** perspective to resolve them.

4. **Draft the Spec**: Modify the copied template based on the previous discussion and micro-grilling:
   - **The Problem / Solution**: Write as a clear, human-readable narrative.
   - **User Experience**: Define scenarios and workflows (not robotic requirement lists).
   - **Feature Boundaries**: Explicitly list what is out of scope to prevent bloat.
   - **Success Criteria**: Define measurable, technology-agnostic outcomes.
   - Remove all instructional HTML comments (like `<!-- ACTION REQUIRED -->`) from copied files.

5. **Report**: Inform the user that the specification is ready and suggest running `/docify.plan`.
