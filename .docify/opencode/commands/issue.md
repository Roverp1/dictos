---
description: Quickly capture a bug, feature, or chore as a GitHub issue through a focused grilling session.
scripts:
  - name: Check gh CLI
    run: |
      if ! command -v gh &> /dev/null; then echo '{"error": "gh cli not found"}'; exit 1; fi
      gh auth status || exit 1
      echo '{"success": true}'
    shell: bash
---

## User Input

```text
$ARGUMENTS
```

Parse the user input for two things:

1. **The issue seed** — the raw description of the bug, feature, or chore.
2. **Additional context request** — if the user mentions "add guidance", "add context", "add proposed solution", or similar, flag that an additional context comment is needed after the issue body.

## Goal

Capture a single, well-articulated GitHub issue through a focused grilling session. Get in, document it, get out.

## Pre-Execution Checks

**1. Dependency Check**:
Verify that the `gh` CLI is installed and authenticated. If the setup script failed, warn the user but continue — the issue will be written to `tmp/issue-draft.md` instead of published.

**2. Repository Check**:
Run `git rev-parse --is-inside-work-tree` to confirm you are in a git repository.

**3. Label Check**:
Run `gh label list` to check if `bug`, `feat`, and `chore` labels exist. Create any that are missing:

```bash
gh label create bug --description "Something is broken" --color D73A4A
gh label create feat --description "New feature or capability" --color 0E8A16
gh label create chore --description "Maintenance, refactoring, cleanup" --color FBCA04
```

Skip label creation silently if `gh` is unavailable.

## Execution Steps

### 1. Grilling

Activate the `grill-docify` skill in **issue** perspective. Use the issue seed from the user input as the starting point.

Grill until all three stopping criteria are met:

- **What** — the problem or desired outcome is clearly articulated
- **Why** — enough context exists to understand the stakes and prioritize later
- **Done-when** — at least one concrete, verifiable acceptance criterion is established

If the user requested additional context, continue grilling to establish:

- Where in the codebase to start looking
- A proposed approach or implementation strategy
- Relevant references (code areas, docs, PRs)

If during the grill, the issue appears to contain multiple unrelated concerns, suggest splitting into separate issues.

### 2. Draft the Issue

Read the template from `.docify/templates/issue/issue-template.md`. Fill it in based on the grilling session.

**Title**: Write a concise title (under 70 characters). Use the pattern: `[label]: short description` (e.g., `bug: race condition in sync loop`).

**Label**: Infer the correct label (`bug`, `feat`, or `chore`) from the conversation. Apply exactly one.

**Additional context comment** (only if requested): Read the template from `.docify/templates/issue/context-template.md` and fill it in based on the grilling session.

### 3. Review

Present the complete draft to the user:

```markdown
### Proposed Issue

**Title:** `<Title>`
**Label:** `<label>`

**Body:**

<Body>
```

If an additional context comment was drafted, present it separately:

```markdown
### Additional Context Comment

<Comment body>
```

Ask: "Does this look good? Reply **yes** to create, or provide feedback."

Wait for explicit approval. Do NOT create without it.

### 4. Publish

If `gh` is available:

1. Write the issue body to a temporary file `tmp/issue-draft.md`.
2. Create the issue:

```bash
gh issue create --title "<TITLE>" --label "<LABEL>" --body-file tmp/issue-draft.md
```

3. If additional context comment exists, post it:

```bash
gh issue comment <ISSUE_NUMBER> --body-file tmp/issue-context.md
```

4. Clean up temporary files.

If `gh` is NOT available:

1. Write the issue body to `tmp/issue-draft.md`.
2. If additional context exists, append it to the same file under a `---` separator.
3. Tell the user: "Issue draft saved to `tmp/issue-draft.md`. Publish it manually when `gh` is available."

### 5. Report

Output the URL of the created issue. Done.
