---
date: April 2026
title: "Architecture Documentation"
---

# Architecture Documentation

This directory splits the arc42 template into smaller files for modular app architecture docs.

Read order:

1. `vision-goals.md`
2. `context-constraints.md`
3. `solution-building-blocks.md`
4. `runtime-deployment.md`
5. `crosscutting-decisions-quality.md`
6. `risks-glossary.md`

SRS map:

- `software-requirements-specification-ieee-830/sections/01-introduction.typ` - purpose, scope, terms, references
- `software-requirements-specification-ieee-830/sections/02-overall-description.typ` - product perspective, functions, users, constraints, roadmap
- `software-requirements-specification-ieee-830/sections/03-specific-requirements.typ` - UI, interfaces, FRs, performance, design constraints, quality attributes
- `software-requirements-specification-ieee-830/sections/04-prioritization.typ` - release prioritization and phase plan
- `software-requirements-specification-ieee-830/sections/05-appendices.typ` - use cases, sequence/class diagrams, DB schema

Practically, only `03-specific-requirements.typ` and `05-appendices.typ` will have usefull information, after reading that arc42 architecture documentation. Others sections will contain majority duplicate information.

Start with `vision-goals.md`, then follow the links from there.
