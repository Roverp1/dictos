= Overall Description

== Product Perspective
Dictos is a local-first application designed to help users create personal dictionaries. While most modern dictionary apps require the cloud, Dictos prioritizes local data sovereignty. It uses libSQL to store data locally and will offer an easy option for cross-device syncing later.

Dictos connects reading sources like ebooks, articles, and notes with study tools like Anki. The system lets users capture raw text, edit it manually, generate definitions using Gemini, organize everything in a nested directory structure, and export local data to study-friendly formats.

The terminal interface uses React bindings for OpenTUI. The core React logic does not depend on OpenTUI or DOM libraries. This isolation allows the logic to be extracted into a separate package and reused across the terminal application, React Native on mobile, and the web.

Future releases will introduce cross-device capabilities and easier ways to collect captures, like a mobile select menu and a browser extension. These features are outside the scope of Release 1.

== Product Functions
Dictos provides the following core functions:

- Import raw text from different sources, starting with TXT files and ReadEra backups.
- Create, edit, move, copy, and delete captures in a nested directory tree.
- Generate definitions for one or multiple captures using Gemini.
- Store and display all definitions for a single capture.
- Manage reusable prompts for LLM requests.
- Edit data directly in the terminal through a keyboard-driven TUI.
- Export local records to Anki decks and JSON formats.

== User Characteristics
The first version of Dictos uses a TUI interface as a baseline for future cross-device management. The TUI caters to users who prefer fast terminal workflows and local data control. The target audience includes:

- Language learners who want to quickly turn reading notes into study material.
- Developers who want a keyboard-driven tool to store and define technical terms.
- Users who want to avoid cloud dependency and keep their data on their own devices.

== Constraints
Dictos operates under the following constraints:

- Gemini API access requires an active internet connection and a user API key.
- Core application functions must remain local-first and usable offline.
- The TUI must work in standard terminal emulators.
- The application must preserve local data even when external services fail.

== Assumptions and Dependencies
The following assumptions and external dependencies apply:

- The user provides a valid Gemini API key.
- LLM generation requires an HTTPS connection to Google servers.
- Available storage space is limited by the host machine.

== Apportioning of Requirements
Requirements are split into three releases to keep the local core simple before adding advanced functionality.

1. V1: Terminal application, local libSQL persistence, ReadEra/TXT import, manual capture entry, Gemini integration, and Anki export.
2. V2: Central server, user accounts, and cross-device syncing.
3. V3: Mobile application in React Native with capture-on-select and dictionary access.