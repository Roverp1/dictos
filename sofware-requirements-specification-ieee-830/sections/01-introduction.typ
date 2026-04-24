= Introduction
// Foundation of the SRS.

== Purpose
// Define Dictos requirements for Release 1.
// Target: Developers and language learners using terminal-centric workflows.
This document specifes the software requirements  for release 1 of "Dictos", a local-first text processing application. It serves as the primary technical contract for academic evaluation, and an architectural guide for future development and contributors.

== Scope
// System name: Dictos.
// Core logic: Capture text, enhance via LLM (Gemini), persist in local SQLite.
// Goal: Efficiently generate Anki flashcards and structured datasets from raw fragments.
Dictos designed to assist users in learning new things they encounter while reading any text on their digital devices, by bridging the gap between unrecognised words or phrases they encounter and specialised long-term memory aids (e.g. Anki flashcads). The system provedis a centralized local environment to:
- Capture raw text fragments from multiple sources.
- Describe captured text with definitions inputed manually or generated with LLM
- Organize captures in directories
- export user's captures into formats compatile with spaced-repetition systems (SRS) or in preferred user format (TXT, JSON, CSV)

The initial release focuses on a Terminal User Interface (TUI) and local libSQL persistence, intentionally excluding internal SRS logic to remain a "pure dictionary management tool"

== Definitions, acronyms, and abbreviations
// Capture: A raw piece of text extracted from a source.
// Category: A logical grouping (e.g., "Polish", "Python").
// Schema: A set of custom fields tied to a category.
// TUI: Terminal User Interface.
// Local-First: Architecture prioritizing local storage over cloud.
- Capture: A raw string of text (word, phrase, or sentence) saved by the user from an external source.
- The word: a subset of the Capture - a Capture that consists of a single word.
- Definition: An explanation or translation of a Capture. Dictos supports one-to-many relationship where a single Capture can have multiple associated Definitions (e.g. for different meanings of the word)
- Directory: A nested folder used to organize captures
- Local-First: An architecutral patter where the application functions entirely offline with a local database, while providing optional functionality available in the cloud (e.g. llm definition generations, cloud capture sync)
- SRS: External study platforms like Anki that Dictos targets for data exoprt.

== References
// 1. IEEE Std 830-1998: Software Requirements Specifications.
// 2. SQLite / libSQL Documentation.
// 3. Google Gemini API Documentation.

== Overview
// Document covers overall description, technical requirements, and prioritization.
// Visual logic is detailed in appendices.
This document is divided into four main sections and a set of technical appendices.
- Section 2 describes the high-level goals of Dictos, focusing on its local-first architecture and its role as a bridge bteween raw text capture and structured flashcards export.
- Section 3 describes requirements for the TUI, the Gemini LLM integration, and the libSQL database.
- Section 4 outlines the project's prioritization and the roadmap from a local TUI MVP to a synced cross device expirience
- The appendices showcase essential engineering models, including UML diagrams and database schemas.
