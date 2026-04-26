= Specific Requirements

== External Interface Requirements

=== User Interfaces
Dictos uses a terminal user interface built with OpenTUI. The interface is optimized for keyboard-driven navigation and quick access to capture data, prompt input, and definition editing.

The main screen uses a two-panel layout:
- Left pane: directory tree for browsing and selecting captures.
- Right pane: main action pane for previewing and editing the selected item.

The interface supports in-place editing for captures, definitions, directories, and prompts. When the user activaties an edit command, the selected row is temporarily replaced with an input field. After confirmation or cancellation, the database record is updated or left unchanged.

The prompt selection flow is dynamic. When the user requests definition generation, the interface will present prompt menu based on current action user performs:
- if user is trying to generate a single definition for current capture - prompt menu will appear in place of left pane, leaving capture menu visible.
- if user is trying to generate definitions for multiple captures selected in the directory tree - prompt menu will appear in place of right pane, leaving directory tree visible.

The prompt menu will display all of the saved prompts, with search bar at the top, allowing for instant search of the saved prompts. With press of a hot key, an input field will appear, for creation of a new prompt - which user can use once or save and use.


=== Hardware Interfaces
Dictos is a software-only application. It requires:
- a standard keyboard for navigation, editing, ad commands
- a terminal emulator that supports interactive text user interfaces.

=== Software Interfaces
Dictos interacts with the following external software components:
- Gemini API: used for automatic definition generation.
- libSQL: used for local persistence
- local file system: used for importing TXT and ReadEra backups and exporting saved data

=== Communications Interfaces
All communication with external services uses HTTPS.

- Gemini requests are sent over HTTPS in JSON format.
- Future synchronization features will also use HTTPS communication with the central server.

== Functional Requirements

=== V1 Functional Requirements

ID: FR-V1-01 | Title: Manual capture entry
DESC: The system must allow the user to create a capture manually from the TUI.
RAT: Users need a fast way to add one capture manually from the TUI.
DEP: None.

ID: FR-V1-02 | Title: Importing ReadEra notes
DESC: The app must allow the user to import e-book notes from a ReadEra backup file.
RAT: ReadEra is a major source of captures for the target users.
DEP: None

ID: FR-V1-03 | Title: Import text files
DESC: The system must allow the user to import raw text captures from TXT files.
RAT: TXT imports support fast capture transfers from external sources.
DEP: None

ID: FR-V1-04 | Title: Manage directories
DESC: The system must allow the user to create, rename, delete, copy, move and nest directories and captures for capture organization.
RAT: The directory tree is the main structure for organizing study material.
DEP: None

ID: FR-V1-05 | Title: Edit captures and definitions
DESC: The system must allow the user to edit captures and definitions directly in the TUI.
RAT: In-place editing reduces friction and keeps the workflow keyboard-centric.
DEP: FR-V1-04

ID: FR-V1-06 | Title: Gemini definition generation
DESC: The system must allow the user to select one or more captures and generate definitions using a chosen prompt with Gemini API.
RAT: This is the core value of Dictos, since it automates the dictionary lookup step.
DEP: Gemini API access, FR-V1-01

ID: FR-V1-07 | Title: Retry failed requests
DESC: If definition generation fails due to a temporary network error, the system must retry the request up to three times before reporting failure and continuing with the next capture.
RAT: Prevents bulk operations from failing because of a temporary connection issue.
DEP: FR-V1-06

ID: FR-V1-08 | Title: Prompt management
DESC: The system must allow the user to enter a prompt for definition generation and optionally save it for later reuse.
RAT: Users have different learning needs for different types of content.
DEP: None

ID: FR-V1-09 | Title: Export local data
DESC: The system must allow the user to export captures and definitions into Anki decks and JSON formats.
RAT: Export is required to move data into spaced-repetition tools and other external apps.
DEP: None

=== V2 Functional Requirements

ID: FR-V2-01 | Title: User registration
DESC: The system must allow the user to create an account for cloud-enabled features.
RAT: Registration is required for social and synchronization features.
DEP: Central server

ID: FR-V2-02 | Title: Sync local data
DESC: The system must allow the user to select an option to synchronize local data stored in the libSQL database across all of the user's devices using the Turso SDK.
RAT: Sync enables cross-device consistency.
DEP: FR-V2-01

ID: FR-V2-03 | Title: Sync shared data to central database
DESC: The system must allow the user to manually synchronize selected shared data and activity aggregates with the central database.
RAT: Central database enables shared features.
DEP: FR-V2-01

ID: FR-V2-04 | Title: Friend relationships
DESC: The system must allow the user to add, accept, and manage friend relationships.
RAT: Friend relationships are required for social visibility and profile-based features.
DEP: FR-V2-01

ID: FR-V2-05 | Title: View social statistics
DESC: The system must allow the user to view public profile data and activity statistics for themselves and their friends.
RAT: This supports leaderboards and friend comparison features.
DEP: FR-V2-01, FR-V2-04

=== V3 Functional Requirements

ID: FR-V3-01 | Title: Mobile access
DESC: The system must allow the user to access and manage core Dictos features from a mobile application.
RAT: Users need the same core workflow on mobile devices.
DEP: FR-V1-09

ID: FR-V3-02 | Title: Mobile capture
DESC: The system must allow the user to capture text from the mobile select or share menu.
RAT: Mobile capture expands the application beyond terminal workflow, allowing for fast capture creation on mobile.
DEP: FR-V3-01

== Performance Requirements
The system shall satisfy the following performance constraints:

- Local libSQL read/write operations must complete in under 50ms.
- LLM requests must not block the user interface.
- The application shall reach an interactive state in under 1 second on standard hardware.

== Design Constraints
The system shall satisfy the following design constraints:

- The application shall remain local-first in Release 1.
- Core features such as capture creation, editing, importing, and exporting must function without internet access.
- The architecture must follow Hexagonal Architecture principles.
- The core domain must remain independent from Gemini, libSQL, terminal framework and operating system/runtime.

== Software System Attributes
The system shall satisfy the following quality attributes:

- Reliability: Database operations must use transactions to preserve integrity during crashes or power loss.
- Portability: The application must run on any POSIX-compliant terminal (Linux, MacOS) and Windows terminal
- Maintainability: The application must keep business logic isolated from external adapters.
- Security: Sensitive network communication must use HTTPS, and user credentials must not be stored in plain text.
