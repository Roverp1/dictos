# Agent Instructions

## SKILL.md editing

SKILL.md is injected into every agent session as context. Keep it compressed and short to save context window:

- **Only good examples** — SKILL.md should only show the correct errore pattern, never "bad" or "before" examples
- **Bad/before examples go in MIGRATION.md** — that file is not loaded into context automatically, so verbosity there is fine
- **Minimal code snippets** — show the smallest snippet that demonstrates the pattern, not full functions with boilerplate
- **Dense prose** — combine related points, avoid repeating what's obvious from the code
- **No redundancy** — if a pattern is already shown elsewhere in SKILL.md, reference it instead of showing it again
