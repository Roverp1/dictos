---
description: Interview the user relentlessly about a feature idea until reaching shared understanding, challenging against existing docs.
handoffs:
  - label: Generate Specification
    agent: docify.specify
    prompt: Generate the feature specification for what we just discussed.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Stress-test a feature plan or idea against the project's language and documented decisions before writing a formal specification.

## Execution Steps

1. **Context Load**: Read `docs/system-overview.md` and `CONTEXT.md` (if they exist) to understand the current reality of the system. If the user's idea relates to a specific existing domain, also read the corresponding `docs/modules/[domain]/` files for deep context.

2. **Interrogate**: Activate the `grill-docify` skill in **overview** perspective to interview the user relentlessly and update `CONTEXT.md` inline.

4. **The Handoff**: Once the scope, edge cases, and architectural approach are agreed upon, decide if the feature requires dedicated specification before implementation, if yes:

- stop and ask the user: "Are we ready to generate the Specification for this?" If yes, suggest running `/docify.specify`.

if feature is simple, and wont need require any documentation changes (e.g. ui improvements, stylization) or specifaciton:

- propose implementation plan to the user
