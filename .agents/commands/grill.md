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

1. **Context Load**: Read `docs/system-overview.md` and `CONTEXT.md` (if they exist) to understand the current reality of the system. If the user's idea relates to a specific existing domain, also read the corresponding `docs/[domain]/` files for deep context.

2. **The Interrogation**: Interview the user relentlessly about every aspect of their idea until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.
   - Ask the questions one at a time, waiting for feedback on each question before continuing.
   - For each question, provide your recommended answer.
   - **Challenge against the glossary**: When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines X as Y, but you seem to mean Z — which is it?"
   - **Sharpen fuzzy language**: When the user uses vague or overloaded terms, propose a precise canonical term.
   - **Discuss concrete scenarios**: Stress-test domain relationships with specific scenarios and edge cases. Invent scenarios that force the user to be precise about boundaries.
   - **Cross-reference with code**: If the user states how something works, explore the codebase to check whether the code agrees. Surface any contradictions.

3. **Inline Updates**: If new domain terms are resolved during the discussion, update `CONTEXT.md` inline immediately. Do not batch them up.

4. **The Handoff**: Once the scope, edge cases, and architectural approach are agreed upon, decide if the feature requires dedicated specification before implementation, if yes:

- stop and ask the user: "Are we ready to generate the Specification for this?" If yes, suggest running `/docify.specify`.

if feature is simple, and wont need require any documentation changes (e.g. ui improvements, stylization) or specifaciton:

- propose implementation plan to the user
