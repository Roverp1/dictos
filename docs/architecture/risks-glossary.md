---
date: April 2026
title: "Risks, Technical Debt and Glossary"
---

# Risks and Technical Debts {#section-technical-risks}

| Risk                                  | Impact                                     | Mitigation                                     |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Core logic leaks into TUI or adapters | Future mobile/web/gui reuse gets ugly fast | Enforce module boundaries and ports.           |
| Gemini becomes too central            | Offline and portability regress            | Keep LLM behind adapter and optional workflow. |
| Local schema drifts across versions   | Data migration pain                        | Keep schema changes explicit and versioned.    |
| Sync design gets bolted on later      | V2 becomes a mess                          | Keep local core sync-ready now.                |
| Prompt handling stays ad hoc          | Reuse and traceability suffer              | Model prompts as first-class local records.    |

# Glossary {#section-glossary}

| Term        | Definition                                             |
| ----------- | ------------------------------------------------------ |
| Capture     | Raw text fragment saved from an external source.       |
| Word        | Capture that consists of a single word.                |
| Definition  | Explanation or translation attached to a capture.      |
| Directory   | Nested folder used to organize captures.               |
| Prompt      | Reusable text template for Gemini requests.            |
| Local-first | App works offline by default and keeps cloud optional. |
| Anki        | Spaced-repetition tool used as export target.          |
| libSQL      | Local transactional database used for V1 persistence.  |
| Gemini      | LLM service used for definition generation.            |

Related SRS: `01-introduction.typ`, `02-overall-description.typ`, `03-specific-requirements.typ`, `05-appendices.typ`

Back to [Architecture Documentation](index.md)
