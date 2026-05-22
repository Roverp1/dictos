#import "../variables.typ": *

= Specific Requirements

== External Interface Requirements

=== User Interfaces
Dictos uses a terminal user interface built with OpenTUI. The interface is optimized for keyboard-driven navigation and quick access to capture data, prompt input, and definition editing.

The main screen uses a two-panel layout:
#v(vSpaceBeforeLists)
- Left pane: directory tree for browsing and selecting captures. It functions like a standard filesystem where each directory can contain multiple captures and nested subdirectories.
- Right pane: main action pane for previewing and editing the selected item.

The interface supports in-place editing for captures, definitions, directories, and prompts. When the user activates an edit command, the selected row becomes an input field. After confirmation or cancellation, the database record updates or remains unchanged.

The prompt selection flow is dynamic. When the user requests a definition, the interface presents a prompt menu based on the current action:
#v(vSpaceBeforeLists)
- If generating a single definition for the current capture, the prompt menu replaces the left pane, leaving the capture menu visible.
- If generating definitions for multiple selected captures, the prompt menu replaces the right pane, leaving the directory tree visible.

The prompt menu displays all saved prompts with a search bar at the top. A hotkey opens an input field to create a new prompt, which the user can run once or save for later.

#figure(
  image("../assets/tui-prototype.png", width: 100%),
  caption: [Prototype of the terminal user interface],
)

=== Hardware Interfaces
Dictos is a software-only application. It requires:
#v(vSpaceBeforeLists)
- A standard keyboard for navigation, editing, and commands.
- A terminal emulator that supports interactive text user interfaces.

=== Software Interfaces
Dictos interacts with the following external software components:
#v(vSpaceBeforeLists)
- Gemini API: used for automatic definition generation.
- libSQL: used for local persistence. The application interacts with libSQL through an ORM to manage schema definitions and migrations.
- Local file system: used for importing TXT and ReadEra backups and exporting saved data.

=== Communications Interfaces
All communication with external services uses HTTPS.
#v(vSpaceBeforeLists)
- Gemini requests are sent over HTTPS in JSON format.
- Future synchronization features will also use HTTPS to communicate with the central server.

== Functional Requirements

=== V1 Functional Requirements

*ID:* FR-V1-01 | *Title:* Manual capture entry \
*DESC:* The system must allow the user to create a capture manually from the TUI. \
*RAT:* Users need a fast way to add one capture manually from the TUI. \
*DEP:* None.

#v(vSpaceBetweenFRs)
*ID:* FR-V1-02 | *Title:* Importing ReadEra notes \
*DESC:* The app must allow the user to import e-book notes from a ReadEra backup file. \
*RAT:* ReadEra is a major source of captures for the target users. \
*DEP:* None.

#v(vSpaceBetweenFRs)
*ID:* FR-V1-03 | *Title:* Import text files \
*DESC:* The system must allow the user to import raw text captures from TXT files. \
*RAT:* TXT imports support fast capture transfers from external sources. \
*DEP:* None.

#v(vSpaceBetweenFRs)
*ID:* FR-V1-04 | *Title:* Manage directories \
*DESC:* The system must allow the user to create, rename, delete, copy, move, and nest directories and captures for organization. \
*RAT:* The directory tree is the main structure for organizing study material. \
*DEP:* None.

#v(vSpaceBetweenFRs)
*ID:* FR-V1-05 | *Title:* Edit captures and definitions \
*DESC:* The system must allow the user to edit captures and definitions directly in the TUI. \
*RAT:* In-place editing reduces friction and keeps the workflow keyboard-centric. \
*DEP:* FR-V1-04

#v(vSpaceBetweenFRs)
*ID:* FR-V1-06 | *Title:* Gemini definition generation \
*DESC:* The system must allow the user to select one or more captures and generate definitions using a chosen prompt with the Gemini API. \
*RAT:* This automates the dictionary lookup step, providing the core value of Dictos. \
*DEP:* Gemini API access, FR-V1-01

#v(vSpaceBetweenFRs)
*ID:* FR-V1-07 | *Title:* Retry failed requests \
*DESC:* If definition generation fails due to a temporary network error, the system must retry the request up to three times before reporting a failure and continuing to the next capture. \
*RAT:* Prevents bulk operations from failing over a temporary connection issue. \
*DEP:* FR-V1-06

#v(vSpaceBetweenFRs)
*ID:* FR-V1-08 | *Title:* Prompt management \
*DESC:* The system must allow the user to enter a prompt for definition generation and optionally save it for later reuse. \
*RAT:* Users have different learning needs for different types of content. \
*DEP:* None.

#v(vSpaceBetweenFRs)
*ID:* FR-V1-09 | *Title:* Export local data \
*DESC:* The system must allow the user to export captures and definitions to Anki decks and JSON formats. \
*RAT:* Exporting moves data into spaced-repetition tools and other external apps. \
*DEP:* None.

=== V2 Functional Requirements

*ID:* FR-V2-01 | *Title:* User registration \
*DESC:* The system must allow the user to create an account for cloud-enabled features. \
*RAT:* Registration is required for social and synchronization features. \
*DEP:* Central server.

#v(vSpaceBetweenFRs)
*ID:* FR-V2-02 | *Title:* Sync local data \
*DESC:* The system must allow the user to synchronize local data stored in the libSQL database across all devices using the Turso SDK. \
*RAT:* Sync enables cross-device consistency. \
*DEP:* FR-V2-01

#v(vSpaceBetweenFRs)
*ID:* FR-V2-03 | *Title:* Sync shared data to central database \
*DESC:* The system must allow the user to manually synchronize selected shared data and activity aggregates with the central database. \
*RAT:* The central database enables shared features. \
*DEP:* FR-V2-01

#v(vSpaceBetweenFRs)
*ID:* FR-V2-04 | *Title:* Friend relationships \
*DESC:* The system must allow the user to add, accept, and manage friend relationships. \
*RAT:* Friend relationships are required for social visibility and profile-based features. \
*DEP:* FR-V2-01

#v(vSpaceBetweenFRs)
*ID:* FR-V2-05 | *Title:* View social statistics \
*DESC:* The system must allow the user to view public profile data and activity statistics for themselves and their friends. \
*RAT:* This supports leaderboards and friend comparison features. \
*DEP:* FR-V2-01, FR-V2-04

=== V3 Functional Requirements

*ID:* FR-V3-01 | *Title:* Mobile access \
*DESC:* The system must allow the user to access and manage core Dictos features from a mobile application. \
*RAT:* Users need the same core workflow on mobile devices. \
*DEP:* FR-V1-09

#v(vSpaceBetweenFRs)
*ID:* FR-V3-02 | *Title:* Mobile capture \
*DESC:* The system must allow the user to capture text from the mobile select or share menu. \
*RAT:* Mobile capture expands the application beyond the terminal workflow, allowing fast capture creation on mobile. \
*DEP:* FR-V3-01

== Performance Requirements
The system shall satisfy the following performance constraints:
#v(vSpaceBeforeLists)
- Local libSQL read/write operations must complete in under 50ms.
- LLM requests must run in the background and not block the user interface.
- The application shall reach an interactive state in under 1 second on standard hardware.

== Design Constraints
The system shall satisfy the following design constraints:
#v(vSpaceBeforeLists)
- The application shall remain local-first in Release 1.
- Core features like capture creation, editing, importing, and exporting must function without internet access.
- The architecture must follow Hexagonal Architecture principles.
- The core domain must remain independent from Gemini, libSQL, the terminal framework, and the operating system/runtime.
- Core React state and business logic must remain independent of specific rendering environments, like OpenTUI or the browser DOM, to support cross-platform reuse.

== Software System Attributes
The system shall satisfy the following quality attributes:
#v(vSpaceBeforeLists)
- Reliability: Database operations must use transactions to preserve integrity during crashes or power loss.
- Portability: The application must run on any POSIX-compliant terminal (Linux, MacOS) and the Windows terminal.
- Maintainability: The application must keep business logic isolated from external adapters.
- Security: Sensitive network communication must use HTTPS, and user credentials must not be stored in plain text.

