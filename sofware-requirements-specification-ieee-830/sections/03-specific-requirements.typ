= Specific Requirements
// The technical core. Precise definitions only.

== External Interface Requirements
=== User Interfaces
// TUI Layout: Sidebar for categories, main list for captures, footer for commands.
// Detailed editing view for schema-specific fields.
The TUI will be built using OpenTUI framework. It will focus on quick keyboard-driven navigation.
- Main View: two-pane layout with a Directory tree sidebar on the left and main action pane on the right
- Main action pane (MAP): will display preview of the hovered item, with all its defenitions when navigating Directory tree. When pressing ENTER on the hovered item in the Directory tree - cursor will be taken to MAP, and user will be able to scroll and select and modify definitions.
- Prompt menu: will apear dinymicly based on what activity user performs. If user is currently in MAP and selecting an option to generate definition, prompt menu will apear on the left - in place of Directory tree. And if user selects many captures in te Directory tree - Prompt menu will appear on the right, in place of MAP // not sure about this one
- Modifications of elements such as prompts, captures and definitions - will happen 'in place'. When user presses modification shortcut when hovering over an item - the item will get temporary replaced with input box containing the item, after saving or canceling modification - the item's row in database will be modified accordingly. If user would press modification shortcut while having selected multiples items - external editor will be opened with all the items for modification (planned for later).


=== Hardware Interfaces
// Standard keyboard for all navigation and data entry.
Dictos is a software-only tool. It requires a standard keyboard (for TUI interface) for all navigation, shortcuts, and text entry.

=== Software Interfaces
// Google Gemini API (HTTPS/JSON).
// SQLite/libSQL for persistence.
// Local file system for .txt and .json imports.
- Gemini API: Used via HTTPS for generating definitiions. Requires user's API_KEY
- libSQL: Local file-based storage for each user

=== Communications Interfaces
// HTTPS protocol for LLM requests.
All externalCommunication is performed via HTTPS. This includes requests to the Gemini API and future synchronization tasks with Turso-hosted central database.

== Functional Requirements
// Format: FR-ID | Title | Description | Rationale.

ID: FR-A | Title: Importing ReadEra notes
DESC: The app must prvoide an option to import e-book notes from ReadEra backup
RAT: ReadEra is a primary source of captures for the target user base
DEP: None

ID: FR-2 | Title: LLM definition generation
DESC: The user can select one ore many Captures for definition generation. The system will process them sequentially using the selected LLM prompt template.
RAT: Allows users to automate the "dictionary look-up" phase of learning
DEP: Gemini API integration

ID: FR-3 | Title: Request retries
DESC: In the event of a network error during LLM generation, the system must automatically retry the request up to 3 times before skipping to the next item and logging the failure
RAT: Prevents bulk operations from crashing due to minor connection issues
DEP: FR-2

ID: FR-4 | Title: Template management
DESC: The system must allow users to create, store, and edit custom prmopt templates (e.g. "Translate to polish wiiith grammar notes", "Define using maximum 10 words and B2 english")
RAT: Users have different llearning needs for different types of content
DEP: None

== Performance Requirements
// Local SQLite operations MUST be near-instant (< 50ms).
// LLM requests SHOULD NOT block the UI.
- Database Latency: Local libSQL read/write operations must complete in under 50ms to maintain TUI responsiveness.
- Non blocking requests: LLM requests must be handled background threads. The TUI must remain interactive, while waiting for an LLM response
- Startup time: The application must reach an interactive state in less than 1 second on standard hardware.

== Design Constraints
// App core MUST be provider agnostic to allow switching LLMs.
// Data integrity MUST be preserved locally if sync fails.
- Local first: Core features (CRUD, local import/export) must function Ntirely without an internet connection
- Architecture: The system must follow Hexagonal Architecture principles to keep core logic isolated from the Gemini Api and runtime environment

== Software System Attributes
// Reliability: Transactional SQLite writes to prevent corruption.
- Reliability: The system must use database transaction to ensure data integrity during crashes or powr failures
- Portability: The application must run on any POSIX-compliant terminal (Linux, MacOS) and Windows terminal
