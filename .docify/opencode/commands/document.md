---
description: Retroactively document an existing, undocumented codebase domain into the living documentation.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Extract the functional reality, data models, and contracts from an existing, implemented codebase feature or domain and document it in a structured Documentation Module.

## Execution Steps

1. **Context Load**: Derive the target domain or feature from the user input (if ambiguous, ask the user). Explore the codebase to understand the implementation details of the target domain. Read the current `docs/system-overview.md`.

2. **Generate Documentation Module**:
   - Create a new Documentation Module directory (e.g., `docs/modules/[domain]/`).
   - Copy the appropriate templates from `.docify/templates/documentation/directory-module/` using shell commands (e.g., `cp`).
   - Fill in `domain.md` based on your codebase exploration. Focus on module responsibilities, core workflows, and any inferred constraints.
   - Fill in `data-model.md` and `contracts.md` based on the database schemas, state shapes, and API/interface boundaries you discovered in the code.
   - Remove all instructional HTML comments (like `<!-- ACTION REQUIRED -->`) from copied files.

3. **Update System Overview**:
   - Update `docs/system-overview.md` to ensure the newly documented domain is listed under Domain Modules with a link to its `domain.md`.

4. **Report**: Inform the user which sections of the living documentation were created and updated.

