= Overall Description
// High-level view of the system.

== Product Perspective
// Dictos starts as a standalone TUI tool.
// It is not a thin client. Data lives in local SQLite.
// Future versions will sync to a central server via libSQL/Turso.
Dictos is a local-first application designed to help users in creation of their personal dictionaries. Most modern dictionary apps are cloud-dependent, Dictos will prioritize local data sovereignty using libSQL, which will for storing  data localy, with easy option of syncing to the cloud - if the users will want to.

The system acts as a middleware layer between reading any text (ebooks, website articles) and study platforms (Anki). It depends on the Google Gemini API for automatic generation of user preffered definitions, but maintains full functionality offline for all non-AI features (addition of captures, manual editing, exporting)

== Product Functions
// Capture: Import text with custom delimiters.
// Categorization: Assign words to categories with custom fields (schemas).
// LLM Enhancement: Fetch definitions and examples using Gemini.
// Prompt Management: Store and edit prompt templates.
// Modification: Edit data directly in the terminal.
// Export: Generate Anki decks and JSON files.
- Import raw text from different file formats (CSV/TXT with cutom delimiters)
- Manage Captures from a nested Directory tree.
- Select multiple Captures or entire Directories to trigger bulk definiton generation using selecet LLM prompt
- Store and display all created Definitions for a single Capture
- Full CRUD operations on Captures and Definitions for a single Capture
- Transform local database records into Anki CSV or standart JSON datasets

== User Characteristics
// Users are self-learners and developers.
// They prefer terminal efficiency over GUI bloat.
// They manage their own API keys.
- Language learners who need to quickly convert their notes into study material.
- Developers who require a centralized, keyboard-driven tool to store and define technical terms encountered in documentation.
- Users who want to avoid costs related to using cloud computing and want their data to remain on their own devices

== Constraints
// Gemini API requires internet. Core logic must stay local-first.
// TUI must be usable in standard terminal emulators.

== Assumptions and Dependencies
// User must provide a valid Gemini API key.
// System assumes local SQLite/libSQL availability.
- LLM generation requires an active HTTPS connection to Google servers
- The database size is limited by the host machine's available disk space

== Apportioning of Requirements
// Release 1: TUI, SQLite, Gemini integration, Anki export.
// Release 2: Central server sync, Web interface.
// Release 3: Mobile app.
Requirements are split into three milestones to ensure a functional local core before adding complexity:
1. Core TUI application, local libSQL persistence, Gemini LLM integration, and Anki export
2. Centralized sync server for cross-device consistency
3. Mobile application (in React Native) for mobile capture and dicitonary access.
