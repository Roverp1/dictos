---
name: docify
description: Run documentation lifecycle workflows. Use when the user requests documentation tasks, including initialization, grilling, specification, planning, task generation, PR description drafting, code documentation, or archiving features.
---

# Docify Router

You execute the docify documentation workflows.

## Routing Rules

Map the user request to the correct markdown command template:

- "init" or "initialize" -> .docify/opencode/commands/init.md
- "grill" or "grill me" -> .docify/opencode/commands/grill.md
- "specify" or "specification" -> .docify/opencode/commands/specify.md
- "plan" or "technical plan" -> .docify/opencode/commands/plan.md
- "tasks" or "generate tasks" -> .docify/opencode/commands/tasks.md
- "document" or "code documentation" -> .docify/opencode/commands/document.md
- "absorb" or "archive" -> .docify/opencode/commands/absorb.md
- "pr" or "create pr" -> .docify/opencode/commands/pr.md
- "issue" or "create issue" -> .docify/opencode/commands/issue.md

## Execution Steps

1. Read the target markdown command file from the filesystem.
2. Follow the execution steps defined in that file.
3. Treat the rest of the user input as the arguments ($ARGUMENTS) for the workflow.
