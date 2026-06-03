#import "../variables.typ": *

#let sql-table(..rows) = {
  table(
    columns: (auto, auto, auto, auto, 1fr),
    table.header(
      [*Name*], [*Type*], [*Null?*], [*Constraint*], [*Description*]
    ),
    ..rows.pos().flatten(),
  )
}

= Appendices
// Visual documentation and logic mapping.

== Appendix I: Cost-Value Analysis

We ranked features on a 1-10 scale for both user value and implementation cost. This helps us decide what to build first. High-value, low-cost features like importing backups go into early releases. Expensive features like synchronization are pushed to later versions unless they block core workflows.

#v(vSpaceBetweenTables)
#figure(
  table(
    columns: (auto, 1fr, auto, auto),
    table.header([*ID*], [*Feature*], [*Value*], [*Cost*]),
    [FR-V1-01], [Manual capture entry], [8], [6],
    [FR-V1-02], [Importing ReadEra notes], [9], [3],
    [FR-V1-03], [Import text files], [6], [2],
    [FR-V1-04], [Manage directories], [9], [6],
    [FR-V1-05], [Edit captures and definitions], [8], [4],
    [FR-V1-06], [Gemini definition generation], [10], [6],
    [FR-V1-07], [Retry failed requests], [5], [2],
    [FR-V1-08], [Prompt management], [7], [4],
    [FR-V1-09], [Export local data], [7], [3],
    [FR-V2-01], [User registration], [6], [5],
    [FR-V2-02], [Sync local data], [8], [10],
    [FR-V2-03], [Sync shared data], [6], [8],
    [FR-V2-04], [Friend relationships], [5], [7],
    [FR-V2-05], [View social statistics], [5], [6],
    [FR-V3-01], [Mobile access], [10], [9],
    [FR-V3-02], [Mobile capture], [9], [7],
  ),
  caption: [Cost-Value estimates (1-10 scale)],
)

#v(vSpaceBetweenTables)
#figure(
  image("../diagrams/diagram-cost-value.png", width: 80%),
  caption: [Cost-Value Analysis Matrix],
)

== Appendix II: UML Diagrams
=== Use Case Diagram
The use case diagram shows what Dictos lets users do and which external systems help each action. It defines functional boundaries for V1 local work, V2 optional sync, and V3 mobile capture.

#v(vSpaceBeforeLists)
#figure(
  image("../diagrams/diagram-use-case.png", height: 100%),
  caption: [System Use Case Diagram],
)

#v(vSpaceBeforeLists)
*Actors:*
- User: main actor. Uses TUI in V1 and V2, mobile app in V3.
- Gemini API: external system actor. Generates definitions for selected captures.
- Cloud Server: external system actor. Stores shared user data and public statistics in later versions.

#v(vSpaceBeforeLists)
*Use cases:*
- Import Notes (V1): User imports raw text from TXT or ReadEra backup into current directory.
- Manual Capture Entry (V1): User types one capture directly in TUI and saves it into local database.
- Manage Directories (V1): User creates, renames, nests, and selects directories to organize captures.
- Generate Definition (V1): User selects one or many captures and one prompt, then Dictos sends text to Gemini API and stores returned definitions locally. This use case uses a temporary prompt or a saved prompt template.
- Save Prompt Template (V1): User can save a useful prompt for later reuse.
- Sync Data (V2): User manually syncs selected public data and activity aggregates to the central database.
- View Social Data (V2): User can view friend profiles, public stats, and leaderboard-related data.
- Mobile Capture (V3): User saves text from mobile select menu into Dictos and then works with it like any other capture.

#v(vSpaceBeforeLists)
*Relationships:*
- Generate Definition depends on Manage Directories, because each capture must belong to a directory.
- Generate Definition depends on Gemini API, because definition generation comes from external model.
- Save Prompt Template is optional. User may use a one-time prompt without saving it.
- Sync Data is optional and manual. It does not run on every local change.
- Mobile Capture extends the core capture workflow, because it adds a new input path but keeps same domain model.

#v(vSpaceBeforeLists)
*Constraints:*
- Core features must work offline.
- Gemini API needs internet.
- Sync features appear only in later versions.
- Local data stays on user device unless explicitly chosen for shared or synced data.


=== Sequence Diagram: Capture Flow
The sequence diagram shows how Dictos processes a capture from user input to local storage, then optionally enriches it with Gemini. It focuses on one use case flow at a time and shows how the TUI, services, database, and external API interact.

#v(vSpaceBeforeLists)
#figure(
  image("../diagrams/diagram-sequence-capture.png", width: 100%),
  caption: [Sequence Diagram: Capture & Definition Generation],
)

#v(vSpaceBeforeLists)
*Lifelines:*
- User: main actor. Starts capture creation and definition generation.
- TUI_View: terminal interaction layer. Receives user input and shows results.
- CaptureService: application service that handles manual capture entry and definition generation.
- ImportService: application service that handles TXT and ReadEra imports.
- libSQL_DB: local persistence layer for captures, prompts, and definitions.
- GeminiAdapter: boundary adapter that sends prompt requests to Gemini API.

#v(vSpaceBeforeLists)
*Flow:*
1. Capture creation
- User enters a capture manually in TUI, or selects a TXT/ReadEra import.
- TUI_View sends the request to CaptureService or ImportService.
- CaptureService stores one capture in libSQL_DB.
or
- ImportService parses the file and passes each parsed capture to CaptureService.createCapture()
- CaptureService validates and stores each capture in libSQL_DB

2. Definition generation
- User selects one or many captures.
- User chooses a prompt template, or enters a temporary prompt and optionally saves it.
- CaptureService reads capture text and prompt data from libSQL_DB.
- CaptureService sends the request to GeminiAdapter.
- GeminiAdapter calls Gemini API and returns generated definition text.

3. Finalization
- CaptureService stores returned definition in libSQL_DB.
- If Gemini fails, CaptureService retries up to 3 times.
- After success or failure, CaptureService notifies TUI_View.
- TUI_View refreshes the list and shows success or error state in a toast.

#v(vSpaceBeforeLists)
*Relationships:*
- ImportService is used only for parsing provided file to get captures.
- CaptureService is used for capture creation and LLM enrichment.
- GeminiAdapter stays outside core logic and only handles API communication.
- libSQL_DB stays local in V1 and is the only persistence target for this flow.

#v(vSpaceBeforeLists)
*Scope:*
- This diagram covers V1 local workflow only.
- V2 and V3 can add sync and mobile-specific capture flows later.


=== Class Diagram: Categories and Schemas
The class diagram describes the main domain objects of Dictos and the application services that coordinate them. It shows how the local-first core is separated from external systems such as SQLite/libSQL and the Gemini API.

#v(vSpaceBeforeLists)
#figure(
  image("../diagrams/diagram-class.png", width: 100%),
  caption: [Core Domain & Architecture Class Diagram],
)

#v(vSpaceBeforeLists)
*Domain objects:*
- Capture: a raw text fragment saved by the user.
- Definition: an explanation or translation attached to a Capture. One Capture can have many Definitions.
- Directory: a nested container used to organize Captures.
- Prompt: a reusable text template used when asking Gemini for a definition. A prompt may be used temporarily or saved for later reuse.
- Activity aggregate: a small record used to track user actions such as captures added, for later statistics and release 2 synchronization.

#v(vSpaceBeforeLists)
*Application services:*
- CaptureService: creates, edits, and deletes Captures, and coordinates definition generation.
- ImportService: reads TXT or ReadEra exports and turns them into Captures.
- DirectoryService: manages directory hierarchy and directory-related changes.
- PromptService: creates and edits saved prompt templates.
- DefinitionService: requests definitions from Gemini and stores returned results.

#v(vSpaceBeforeLists)
*Ports and adapters:*
- Repository interfaces define how the application talks to persistence, for example CaptureRepository, DefinitionRepository, DirectoryRepository, and PromptRepository.
- LlmPort defines how the core requests generated text from an external model.
- Sqlite/libSQL adapters implement repository interfaces and store data in the local database.
- GeminiAdapter implements LlmPort and sends definition requests to the Gemini API.
- TUI adapter connects user actions from the terminal interface to application services.

#v(vSpaceBeforeLists)
*Relationships:*
- One Directory can contain many Captures.
- One Capture can have many Definitions.
- One Prompt can be reused for many definition requests.
- CaptureService uses CaptureRepository, DefinitionRepository, and LlmPort.
- ImportService uses ImportPort and CaptureRepository.
- DirectoryService uses DirectoryRepository.
- PromptService uses PromptRepository.
- Concrete adapters stay outside the core and implement the interfaces used by services.

#v(vSpaceBeforeLists)
*Scope:*
- In V1, the diagram focuses on local entities, services, and adapters needed for capture creation, import, prompt handling, and LLM enrichment.
- In V2, the model can be extended with User, Friend, and Device objects for cloud features.
- In V3, mobile-specific capture logic can be added without changing the core domain model.

== Appendix III: Database Schema

This appendix defines the physical database schema of Dictos. The schema is split into two scopes: the local database used in V1 and the central database introduced in V2. This separation preserves the local-first architecture while allowing later shared and social features. Data types reflect SQLite/libSQL conventions.

=== V1 Local Database

The local database stores all core user data and must function without network access. It contains the entities needed for capture management, definition storage, directory organization, prompt storage, and local activity tracking.

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([text], [text], [No], [-], [Raw text fragment saved by the user.]),
    (
      [directory_id],
      [integer],
      [No],
      [FK, CASCADE],
      [References `directories.id`. Deletes cascade.],
    ),
    (
      [created_at],
      [integer],
      [No],
      [-],
      [Creation timestamp in epoch seconds.],
    ),
    (
      [modified_at],
      [integer],
      [No],
      [-],
      [Updated by trigger on `captures` when the row changes.],
    ),
  ),

  caption: [Captures table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    (
      [capture_id],
      [integer],
      [No],
      [FK, CASCADE],
      [References `captures.id`. Deletes cascade.],
    ),
    (
      [text],
      [text],
      [No],
      [-],
      [Generated or manually entered definition attached to a capture.],
    ),
    (
      [created_at],
      [integer],
      [No],
      [-],
      [Creation timestamp in epoch seconds.],
    ),
    (
      [modified_at],
      [integer],
      [No],
      [-],
      [Updated by trigger on `definitions` when the row changes.],
    ),
  ),

  caption: [Definitions table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    (
      [name],
      [text],
      [No],
      [-],
      [Directory label used in the hierarchical tree.],
    ),
    (
      [parent_id],
      [integer],
      [Yes],
      [FK, CASCADE],
      [References `directories.id` for nested directories. Deletes cascade.],
    ),
    (
      [privacy],
      [text],
      [No],
      [-],
      [Defaults to `private`; controls whether the directory may later be shared as `public` or `unlisted`.],
    ),
    (
      [created_at],
      [integer],
      [No],
      [-],
      [Creation timestamp in epoch seconds.],
    ),
    (
      [modified_at],
      [integer],
      [No],
      [-],
      [Updated by trigger on `directories` and by related capture changes under that directory.],
    ),
  ),

  caption: [Directories table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([name], [text], [Yes], [-], [Human-readable prompt label.]),
    ([text], [text], [No], [-], [Prompt text entered by the user.]),
    (
      [created_at],
      [integer],
      [No],
      [-],
      [Creation timestamp in epoch seconds.],
    ),
    (
      [modified_at],
      [integer],
      [No],
      [-],
      [Updated by trigger on `prompts` when the row changes.],
    ),
  ),

  caption: [Prompts table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    (
      [date],
      [text],
      [No],
      [UNIQUE],
      [Calendar day of the aggregate in ISO 8601 format.],
    ),
    (
      [count],
      [integer],
      [No],
      [-],
      [Defaults to `1`; total captures added on that day.],
    ),
  ),

  caption: [Captures added table],
)

=== V2 Central Database

The central database stores account and social data. It does not replace the local database. It only supports functionality that requires cross-user visibility or server-side coordination.

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    (
      [username],
      [text],
      [No],
      [UNIQUE],
      [Public display name used by friends and leaderboards.],
    ),
    (
      [email],
      [text],
      [No],
      [UNIQUE],
      [Account email address used for authentication.],
    ),
    (
      [password_hash],
      [text],
      [No],
      [-],
      [Hashed password stored for login verification.],
    ),
    ([bio], [text], [Yes], [-], [Optional short profile description.]),
    ([avatar_url], [text], [Yes], [-], [Optional profile image URL.]),
    (
      [created_at],
      [integer],
      [No],
      [-],
      [Account creation timestamp in epoch seconds.],
    ),
    (
      [last_login_at],
      [integer],
      [No],
      [-],
      [Timestamp of the most recent successful login in epoch seconds.],
    ),
  ),

  caption: [Users table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    (
      [user_id],
      [integer],
      [No],
      [FK],
      [References `users.id` for the owner of the friendship record.],
    ),
    (
      [friend_user_id],
      [integer],
      [No],
      [FK],
      [References `users.id` for the other user.],
    ),
    (
      [status],
      [text],
      [No],
      [-],
      [Defaults to `pending`; becomes `accepted` after approval.],
    ),
    (
      [created_at],
      [integer],
      [No],
      [-],
      [Friend request creation timestamp in epoch seconds.],
    ),
  ),

  caption: [Friends table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([user_id], [integer], [No], [FK], [References `users.id`.]),
    ([device_name], [text], [No], [-], [Human-readable name of the device.]),
    (
      [last_sync_at],
      [integer],
      [No],
      [-],
      [Timestamp of the most recent sync from this device in epoch seconds.],
    ),
  ),

  caption: [Devices table],
)

#v(vSpaceBetweenTables)
#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([user_id], [integer], [No], [FK], [References `users.id`.]),
    (
      [date],
      [text],
      [No],
      [UNIQUE],
      [Calendar day of the aggregate in ISO 8601 format.],
    ),
    (
      [count],
      [integer],
      [No],
      [-],
      [Defaults to `0`; total captures added for the given day.],
    ),
  ),

  caption: [Central captures added table],
)

=== Schema Notes

#v(vSpaceBeforeLists)
- `captures.directory_id` references `directories.id`.
- `definitions.capture_id` references `captures.id`.
- `directories.parent_id` references `directories.id` for nested structure.
- `modified_at` is maintained by table-specific triggers in `captures`, `definitions`, `directories`, and `prompts`.
- `captures_added.count` defaults to `1` and stores a daily aggregate. It is updated by a database trigger.
- `directories.privacy` defaults to `private`.
- `friends.status` defaults to `pending`.
- `users.last_login_at` is updated after successful authentication.
- A unique constraint on `(text, directory_id)` in the `captures` table prevents duplicate captures in the same directory.
- A unique constraint on `(name, parent_id)` in the `directories` table prevents duplicate folder names at the same level.
- A check constraint on `directories.privacy` ensures the value is strictly `private`, `public`, or `unlisted`.

