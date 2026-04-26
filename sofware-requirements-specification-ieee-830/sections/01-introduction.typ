= Introduction

== Purpose
This document specifies the software requirements  for release 1 of Dictos, a local-first text processing application. It serves as the primary technical contract for academic evaluation, as an architectural guide for future development and contributors, and as a baseline for future implementation and extension.

== Scope
Dictos is designed to help users turn raw text fragments, they encounter while reading text on their digital devices, into structured study material. The system supports capture of text from external sources, definition generation with Gemini, organization through directories, and export to formats suitable for spaced-repetition tools such as Anki.

The initial release focuses on a Terminal User Interface and local libSQL persistence, intentionally excluding internal SRS logic to remain a "pure dictionary management tool", while reserving advanced functionality, such as cross platform use of the app, for later versions.

== Definitions, acronyms, and abbreviations
- Capture: A raw string of text (word, phrase, or sentence) saved by the user from an external source.
- Word: a subset of the Capture - a Capture that consists of a single word.
- Definition: An explanation or translation of a Capture. One capture may have multiple definitions.
- Directory: A nested folder used to organize captures
- Local-First: An architectural approach where the application functions offline by default and  treats cloud features as optional.
- SRS: Spaced-repetition system, such as Anki.

== References
- IEEE Std 830-1998, Software Requirements Specifications.
- libSQL and Turso documentation.
- Google Gemini API documentation.

== Overview
This document is divided into four main sections and a set of appendices.
- Section 2 describes the overall product perspective, user characteristics, constraints, and release scope.
- Section 3 defines external interfaces, functional requirements, performance requirements, and design constraints.
- Section 4 explains the prioritization method and release plan.
- Section 5 contains appendices with UML diagrams and database schema description
