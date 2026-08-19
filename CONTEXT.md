# Dictos Context

Dictos is a local-first, keyboard-driven application for building and managing personal dictionaries.

## Language

**Entry**:
A raw text fragment (word, phrase, or sentence) saved by the user from an external source or entered manually, which acts as the target for definitions.
_Avoid_: Capture, Word, Note, Term

**Description**:
User-authored or generated text attached to an Entry, classified by Description Type and optionally grouped under a Sense.
_Avoid_: Annotation, Meaning, Note

**Description Type**:
The fixed classification of a Description: `misc`, `translation`, `definition`, or `example`.
_Avoid_: Label, Category, Kind

**Sense**:
A named interpretation of an Entry that groups related Descriptions.
_Avoid_: Meaning, Definition Group, Description Group

**Folder**:
A nested container used to organize Entries.
_Avoid_: Directory, Dictionary, Deck, Collection

**Instruction**:
A reusable user-authored directive that guides Description Generation.
_Avoid_: Prompt, Prompt Template, Preset, Recipe, AI Instruction

**Description Generation**:
The action of creating typed Descriptions from a selected Description using an Instruction and Model.
_Avoid_: AI Generation, LLM Generation, Definition Generation

**Provider Connection**:
A device-local configuration used to access Models from an external provider.
_Avoid_: Provider Account, Integration, LLM Configuration

**Activity**:
A daily record logging the count of actions a user has taken (e.g., adding entries) to power heatmaps and future gamification. Distinct from future "Statistics".
_Avoid_: Activity Aggregate, Stat, Metric

**Export**:
The action of transforming a selection of Folders, Entries, and Descriptions into an external file format (e.g., Anki, JSON).
_Avoid_: Flashcard, Deck, Sync (when referring to file output)

**Dictionary**:
The total collection of a user's Folders, Entries, and Descriptions. In the UI, this refers to the primary view/page used to browse and manage this data.
_Avoid_: Library, Collection, Explorer, Browser

**Sync**:
The automated, bidirectional replication of private local data across a single user's devices (powered by libSQL/Turso).
_Avoid_: Publish, Upload, Social Sync

**Mirroring**:
The automated, unidirectional background process that pushes a user's shared data (folders, activity stats) from their local database to the central server so it can be viewed by others.
_Avoid_: Social Sync, Publishing, Broadcasting

**Active Pane**:
The section of the interface currently receiving keyboard input.

**Tree Cursor**:
The Entry or Folder currently highlighted while browsing the Dictionary.
_Avoid_: Focused Item, Selected Item

**Description Cursor**:
The Description currently highlighted while viewing an Entry.

**Active Entry**:
The Entry explicitly opened by the user for viewing or editing its Descriptions.
_Avoid_: Active Item, Open Item, Selected Entry

**Selected Tree Items**:
Entries and Folders explicitly marked by the user for batch actions.
_Avoid_: Selection Pool, Selected Items, Multi-select state

**Context Menu Target**:
The item a context menu action applies to after a right-click or long-press.
_Avoid_: Selected Item, Active Item, Focused Item

**Notification**:
A user-visible message describing the outcome of an application action, such as a handled failure, success, or progress state. Clients decide how a Notification is rendered, for example as a toast, snackbar, inline banner, or terminal overlay.
_Avoid_: Toast, Alert, Snackbar, Error Message

**System Overview**:
The primary entry point document (`docs/system-overview.md`) for understanding the project's purpose, architecture, tech stack, codebase map, and domain modules.

**Documentation Module**:
A folder in `/docs/modules/` dedicated to defining the contracts, data model, and domain rules for a specific Domain Module.

**Specification**:
A detailed plan document for a specific feature, located in dedicated specifications directory `/specs/`, containing the data model, spec, and tasks.
