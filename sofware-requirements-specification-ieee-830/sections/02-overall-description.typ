= Overall Description

== Product Perspective
Dictos is a local-first application designed to assist users in creation of their personal dictionaries. Most modern dictionary apps are cloud-dependent, Dictos will prioritize local data sovereignty using libSQL, which will allow to store data localy, with easy option cross-device syncing.

Dictos acts as a bridge between reading sources such as ebooks, articles and notes, and study tools such as Anki. The system supports capture of raw text, manual editing, definition generation through Gemini, organization through a hierarchical directory structure, and export of local data into study-friendly formats.

Future release will introduce cross-device capabilities, and easier ways of collecting captures (such mobile select menu and browser extension), but these features are outside of the scope of Release 1.

== Product Functions
Dictos provides the following core functions:

- Import raw text from different sources, starting with TXT files and ReadEra backups.
- Create, edit, move, copy and delete captures in a nested directory tree.
- Generate definitions for one or many captures using Gemini.
- Store and display all Definitions for a single Capture
- Manage reusable prompts for LLM requests.
- Edit data directly in the terminal through a keyboard-driven TUI.
- EXport local records into Anki decks and JSON formats.

== User Characteristics
First version of Dictos with TUI interface is intened primarly as a baseline for future cross-device capture managment. Non the less TUI interface is intended for users who prefer fast terminal workflows and local data control, and will interest the following users:

- Language learners who want to quickly turn reading notes into study material.
- Developers who want keyboard-driven tool to store and defining technical terms.
- Users who want to avoid cloud dependency and keep their data on their own devices.

== Constraints
Dictos is subject to the following constraints:

- Gemini API access requires an active internet connection and user's API key.
- Core application functions must remain local-first and usable offline.
- The TUI must work a standard terminal emulators.
- The application must preserve local data even when external services are unavailable.

== Assumptions and Dependencies
The following assumptions and external dependencies apply:

- The user provides a valid Gemini API key.
- LLM generation requires HTTPS connection to Google servers.
- Available storage space is limited by the host machine.

== Apportioning of Requirements
Requirements are split into three release to keep the local core simple before advanced functionality.

1. V1: Terminal application, local libSQL persistence, ReadEra/TXT import, manual capture entry, Gemini integration, and Anki export
2. V2: Central server, user accounts, and cross-device syncing.
3. V3: Mobile application in React Native with capture on select and dicitonary access.
