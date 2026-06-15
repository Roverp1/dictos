---
description: Create a Pull Request based on the project's PR template using the GitHub CLI (gh), ensuring quality through a rigorous pre-review grilling process.
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

You **MUST** consider the user input before proceeding (if not empty). If the user specifies a title, draft type, base branch, or specific reviewers, ensure they are respected in the creation step.

## Objective

Do **not** blindly create a Pull Request. Your goal is to act as a rigorous pre-reviewer. You will absorb the current changes, validate them against the project's PR template, find questionable or problematic code, and **grill the user** to establish a shared understanding of _why_ decisions were made.

Only after this shared understanding is reached will you draft the final PR description.

## Pre-Execution Checks

**1. Dependency Check**:
Verify that the `gh` CLI is installed and authenticated. If the setup script failed, tell the user to install the GitHub CLI and run `gh auth login`, but proceed with drafting the pr in the `tmp/${00X-pr-title}.md`.

**2. Repository State Check**:

- Run `git rev-parse --is-inside-work-tree` to ensure you are in a git repository.
- Run `git branch --show-current` to identify the active branch.
- Run `git status -s` to ensure there are no uncommitted changes. If there are, ask the user to commit or stash them first.

## Execution Steps

### 1. Context Gathering (Silent Execution)

Before speaking to the user, you must autonomously gather empirical data about the changes. Execute the following silently:

- Check if the branch has an upstream: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`. If it fails, push the branch using `git push -u origin HEAD`.
- Determine the base branch if not specificied by the user (default to `main` or `master`): `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`
- Get the commit history for this branch: `git log --oneline --graph`
- Check for fixup/squash commits: `git log origin/<base-branch>..HEAD --grep="^fixup\!\|^squash\!" --oneline`
- Get the full diff: `git diff origin/<base-branch>..HEAD` (use stat and detailed diffs as needed).

### 2. Locate PR Template

Search for standard GitHub PR templates in the repository. Look for the first existing file among:

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/pull_request_template.md`
- `PULL_REQUEST_TEMPLATE.md`
- `docs/pull_request_template.md`

_Note: If `.github/PULL_REQUEST_TEMPLATE/` exists as a directory with multiple templates, ask the user which one to use._

If no template is found, proceed using a standard, professional PR structure: What, Why, How to review, and Testing.

### 3. Identify "Grill" Targets

Based on your context gathering and the PR template, generate an internal queue of discrepancies, unverified checklist items, and architectural questions.

**Examples of Grill Targets:**

- **Fixup Commits**: If `fixup!` or `squash!` commits exist in the branch history, this is an immediate Grill Target. Advise the user to squash them (e.g., `git rebase -i --autosquash origin/<base-branch>`) before proceeding.
- **Template Mismatches**: The template requires an issue ticket, but none is found in the branch name or commits.
- **Unverified Checklists**: The PR template checklist mentions "Execution verified in staging" or "Manual verification completed". You cannot prove this from a diff. You MUST grill the user about it.
- **Empirical Check**: Did they add complex logic without tests? Run a search to see if test files were actually modified. If not, this is a Grill Target.
- **Missing Verifications**: "Rollback strategy verified", but no migration or rollback scripts are present.
- **Reviewer Guidance**: Identifying messy boilerplate that the reviewer should ignore (to populate the "How to Review" section).

### 4. Pre-Review Grilling (Interactive)

Activate the `grill-docify` skill in **verification** perspective to grill the user relentlessly on the identified Grill Targets.

### 5. Final PR Draft & Interactive Review

Once the user has answered all your concerns and you have no further Grill Targets, synthesize the final PR description.

**Title Rules**:

- Keep it under 70 characters.
- Use Conventional Commits format if applicable.

**Body Rules**:

- Strictly follow the PR template formatting.
- Incorporate the user's answers into the "Why" and "How to review" sections.
- For markdown checklists (`- [ ]`), mark them as complete (`- [x]`) **only** if you have empirical proof (e.g., tests in the diff) OR if the user confirmed them during the Grilling Loop.

Present the final Markdown draft to the user for approval.

```markdown
### Final Proposed Pull Request

**Title:** `<Title>`

**Body:**
`<Body>`

---

Does this look good to you? Reply **"yes"** to create the PR, or provide instructions to refine it.
```

Wait for the user's response. Do NOT proceed to creation without explicit approval.

### 6. Create Pull Request

Once approved, write the finalized PR body to a temporary file: `tmp/${00X-pr-title}.md`.

Execute the `gh` command to create the PR:

```bash
gh pr create --title "<TITLE>" --body-file tmp/${00X-pr-title}.md
```

_(Append `--draft` if the user requested a draft PR in the arguments)._

Clean up the temporary file (only if pr was created with `gh`):

```bash
rm tmp/${00X-pr-title}.md
```

## Post-Execution

Report the final status to the user:

- Output the URL of the newly created Pull Request.
- Suggest next steps, such as adding reviewers (`gh pr edit --add-reviewer <username>`) or viewing the PR in the browser (`gh pr view --web`).