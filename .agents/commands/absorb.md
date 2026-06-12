---
description: Absorb a completed feature into the living documentation and archive the specification.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Perform the final documentation handshake: update the evergreen System Overview and Documentation Modules, then archive the time-bound feature spec.

## Execution Steps

1. **Context Load**: Derive the target feature from the user input or context (if ambiguous, ask the user). Read the completed feature's `plan.md`, `spec.md`, and review the actual code changes implemented (via git or codebase exploration). Read the current `docs/system-overview.md`.

2. **Update Living Documentation**:
   - **System Overview**: Update `docs/system-overview.md` to reflect the new system capabilities, architecture, and domains introduced by this feature. Do not delete existing accurate information.
   - **Documentation Modules**:
     - If a domain section in the System Overview has grown significantly (or will require description of data-models or contracts), extract it autonomously into a new Documentation Module (e.g., `docs/[domain]/domain.md`), copying the appropriate templates from `.docify/templates/documentation/directory-module/`.
     - Update existing modules with new data models and contracts from the feature's `plan.md`.

3. **Archive the Spec**:
   - Ensure a `specs/.archive/` directory exists.
   - Move the completed `specs/00X-[feature-name]` directory into `specs/.archive/`.

4. **Report**: Inform the user exactly which sections of the living documentation were updated, which modules were created/modified, and confirm the specification has been archived.
