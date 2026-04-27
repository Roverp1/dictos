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
// Tables mapping features to importance metrics.

== Appendix II: UML Diagrams
=== Use Case Diagram
The use case diagram shows what Dictos lets users do and which external systems help each action. It defines functional boundaries for V1 local work, V2 optional sync, and V3 mobile capture.

Actors:
- User: main actor. Uses TUI in V1 and V2, mobile app in V3.
- Gemini API: external system actor. Generates definitions for selected captures.
- Cloud Server: external system actor. Stores shared user data and public statistics in later versions.

Use cases:
- Import Notes (V1): User imports raw text from TXT or ReadEra backup into current directory.
- Manual Capture Entry (V1): User types one capture directly in TUI and saves it into local database.
- Manage Directories (V1): User creates, renames, nests, and selects directories to organize captures.
- Generate Definition (V1): User selects one or many captures and one prompt, then Dictos sends text to Gemini API and stores returned definitions locally. This use case uses a temporary prompt or a saved prompt template.
- Save Prompt Template (V1): User can save a useful prompt for later reuse.
- Sync Data (V2): User manually syncs selected public data and activity aggregates to the central database.
- View Social Data (V2): User can view friend profiles, public stats, and leaderboard-related data.
- Mobile Capture (V3): User saves text from mobile select menu into Dictos and then works with it like any other capture.

Relationships:
- Generate Definition depends on Manage Directories, because each capture must belong to a directory.
- Generate Definition depends on Gemini API, because definition generation comes from external model.
- Save Prompt Template is optional. User may use a one-time prompt without saving it.
- Sync Data is optional and manual. It does not run on every local change.
- Mobile Capture extends the core capture workflow, because it adds a new input path but keeps same domain model.

Constraints:
- Core features must work offline.
- Gemini API needs internet.
- Sync features appear only in later versions.
- Local data stays on user device unless explicitly chosen for shared or synced data.


=== Sequence Diagram: Capture Flow
The sequence diagram shows how Dictos processes a capture from user input to local storage, then optionally enriches it with Gemini. It focuses on one use case flow at a time and shows how the TUI, services, database, and external API interact.

Lifelines:
- User: main actor. Starts capture creation and definition generation.
- TUI_View: terminal interaction layer. Receives user input and shows results.
- CaptureService: application service that handles manual capture entry and definition generation.
- ImportService: application service that handles TXT and ReadEra imports.
- libSQL_DB: local persistence layer for captures, prompts, and definitions.
- GeminiAdapter: boundary adapter that sends prompt requests to Gemini API.

Flow:
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

Relationships:
- ImportService is used only for parsing provided file to get captures.
- CaptureService is used for capture creation and LLM enrichment.
- GeminiAdapter stays outside core logic and only handles API communication.
- libSQL_DB stays local in V1 and is the only persistence target for this flow.

Scope:
- This diagram covers V1 local workflow only.
- V2 and V3 can add sync and mobile-specific capture flows later.


=== Class Diagram: Categories and Schemas
The class diagram describes the main domain objects of Dictos and the application services that coordinate them. It shows how the local-first core is separated from external systems such as SQLite/libSQL and the Gemini API.
Domain objects:
- Capture: a raw text fragment saved by the user.
- Definition: an explanation or translation attached to a Capture. One Capture can have many Definitions.
- Directory: a nested container used to organize Captures.
- Prompt: a reusable text template used when asking Gemini for a definition. A prompt may be used temporarily or saved for later reuse.
- Activity aggregate: a small record used to track user actions such as captures added, for later statistics and release 2 synchronization.

Application services:
- CaptureService: creates, edits, and deletes Captures, and coordinates definition generation.
- ImportService: reads TXT or ReadEra exports and turns them into Captures.
- DirectoryService: manages directory hierarchy and directory-related changes.
- PromptService: creates and edits saved prompt templates.
- DefinitionService: requests definitions from Gemini and stores returned results.
Ports and adapters:
- Repository interfaces define how the application talks to persistence, for example CaptureRepository, DefinitionRepository, DirectoryRepository, and PromptRepository.
- LlmPort defines how the core requests generated text from an external model.
- Sqlite/libSQL adapters implement repository interfaces and store data in the local database.
- GeminiAdapter implements LlmPort and sends definition requests to the Gemini API.
- TUI adapter connects user actions from the terminal interface to application services.

Relationships:
- One Directory can contain many Captures.
- One Capture can have many Definitions.
- One Prompt can be reused for many definition requests.
- CaptureService uses CaptureRepository, DefinitionRepository, and LlmPort.
- ImportService uses ImportPort and CaptureRepository.
- DirectoryService uses DirectoryRepository.
- PromptService uses PromptRepository.
- Concrete adapters stay outside the core and implement the interfaces used by services.
Scope:
- In V1, the diagram focuses on local entities, services, and adapters needed for capture creation, import, prompt handling, and LLM enrichment.
- In V2, the model can be extended with User, Friend, and Device objects for cloud features.
- In V3, mobile-specific capture logic can be added without changing the core domain model.

== Appendix III: Database Schema

This appendix defines the physical database schema of Dictos. The schema is split into two scopes: the local database used in V1 and the central database introduced in V2. This separation preserves the local-first architecture while allowing later shared and social features.

=== V1 Local Database

The local database stores all core user data and must function without network access. It contains the entities needed for capture management, definition storage, directory organization, prompt storage, and local activity tracking.

#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([text], [text], [No], [-], [Raw text fragment saved by the user.]),
    ([directory_id], [integer], [No], [FK], [References `directories.id`.]),
    ([created_at], [timestamptz], [No], [-], [Creation timestamp.]),
    (
      [modified_at],
      [timestamptz],
      [No],
      [-],
      [Updated by trigger on `captures` when the row changes.],
    ),
  ),

  caption: [Captures table],
)

#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([capture_id], [integer], [No], [FK], [References `captures.id`.]),
    (
      [text],
      [text],
      [No],
      [-],
      [Generated or manually entered definition attached to a capture.],
    ),
    ([created_at], [timestamptz], [No], [-], [Creation timestamp.]),
    (
      [modified_at],
      [timestamptz],
      [No],
      [-],
      [Updated by trigger on `definitions` when the row changes.],
    ),
  ),

  caption: [Definitions table],
)

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
      [FK],
      [References `directories.id` for nested directories.],
    ),
    (
      [privacy],
      [text],
      [No],
      [-],
      [Defaults to `private`; controls whether the directory may later be shared as `public` or `unlisted`.],
    ),
    ([created_at], [timestamptz], [No], [-], [Creation timestamp.]),
    (
      [modified_at],
      [timestamptz],
      [No],
      [-],
      [Updated by trigger on `directories` and by related capture changes under that directory.],
    ),
  ),

  caption: [Directories table],
)

#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([name], [text], [Yes], [-], [Human-readable prompt label.]),
    ([text], [text], [No], [-], [Prompt text entered by the user.]),
    ([created_at], [timestamptz], [No], [-], [Creation timestamp.]),
    (
      [modified_at],
      [timestamptz],
      [No],
      [-],
      [Updated by trigger on `prompts` when the row changes.],
    ),
  ),

  caption: [Prompts table],
)

#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([date], [date], [No], [UNIQUE], [Calendar day of the aggregate.]),
    (
      [count],
      [integer],
      [No],
      [-],
      [Defaults to `0`; total captures added on that day.],
    ),
  ),

  caption: [Captures added table],
)

=== V2 Central Database

The central database stores account and social data. It does not replace the local database. It only supports functionality that requires cross-user visibility or server-side coordination.

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
    ([created_at], [timestamptz], [No], [-], [Account creation timestamp.]),
    (
      [last_login_at],
      [timestamptz],
      [No],
      [-],
      [Timestamp of the most recent successful login.],
    ),
  ),

  caption: [Users table],
)

#figure(
  // can probably get rid id, and make user_id + friend_user_id a pk
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
      [timestamptz],
      [No],
      [-],
      [Friend request creation timestamp.],
    ),
  ),

  caption: [Friends table],
)

#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([user_id], [integer], [No], [FK], [References `users.id`.]),
    ([device_name], [text], [No], [-], [Human-readable name of the device.]),
    (
      [last_sync_at],
      [timestamptz],
      [No],
      [-],
      [Timestamp of the most recent sync from this device.],
    ),
  ),

  caption: [Devices table],
)

#figure(
  sql-table(
    ([id], [integer], [No], [PK], [Primary key]),
    ([user_id], [integer], [No], [FK], [References `users.id`.]),
    ([date], [date], [No], [UNIQUE], [Calendar day of the aggregate.]),
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

- `captures.directory_id` references `directories.id`.
- `definitions.capture_id` references `captures.id`.
- `directories.parent_id` references `directories.id` for nested structure.
- `modified_at` is maintained by table-specific triggers in `captures`, `definitions`, `directories`, and `prompts`.
- `captures_added.count` defaults to `0` and stores a daily aggregate, not raw events.
- `directories.privacy` defaults to `private`.
- `friends.status` defaults to `pending`.
- `users.last_login_at` is updated after successful authentication.

// == Appendix IV: Tui Wireframes
// draft layout of the terminal interface.
