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

3. **Micro-Grilling (Just-in-Time Resolution)**: While translating the idea into the spec, if you encounter a missing product detail, an unhandled edge case, or an ambiguity:
   - **DO NOT guess, hallucinate, or leave placeholders.**
   - Stop and "grill" the user on that specific decision in the chat.
   - Propose a strong recommendation based on UX best practices (e.g., "I noticed we didn't discuss what happens if a sync fails halfway. I recommend we queue the failure and retry silently. Do you agree, or do you want to show an error to the user?").
   - Wait for their answer, refine the decision together, and _then_ write the final agreed-upon outcome into the spec.

4. **Draft the Spec**: Modify the copied template based on the previous discussion and micro-grilling:
   - **The Problem / Solution**: Write as a clear, human-readable narrative.
   - **User Experience**: Define scenarios and workflows (not robotic requirement lists).
   - **Feature Boundaries**: Explicitly list what is out of scope to prevent bloat.
   - **Success Criteria**: Define measurable, technology-agnostic outcomes.
   - Remove all instructional HTML comments (like `<!-- ACTION REQUIRED -->`) from copied files.

5. **Report**: Inform the user that the specification is ready and suggest running `/docify.plan`.
