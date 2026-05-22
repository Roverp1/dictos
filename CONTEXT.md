# Dictos Context

Dictos is a local-first, keyboard-driven application for building and managing personal dictionaries.

## Language

**Entry**:
A raw text fragment (word, phrase, or sentence) saved by the user from an external source or entered manually, which acts as the target for definitions.
_Avoid_: Capture, Word, Note, Term

**Description**:
An explanation, translation, or other user-defined text attached to an Entry. It includes a type or label (e.g., "translation", "explanation").
_Avoid_: Definition, Annotation, Meaning, Note

**Folder**:
A nested container used to organize Entries.
_Avoid_: Directory, Dictionary, Deck, Collection

**Instruction**:
A reusable text template saved by the user, which is combined with an Entry to form the final prompt sent to the LLM API.
_Avoid_: Prompt, Prompt Template, Preset, Recipe, AI Instruction

**Activity**:
A daily record logging the count of actions a user has taken (e.g., adding entries) to power heatmaps and future gamification. Distinct from future "Statistics".
_Avoid_: Activity Aggregate, Stat, Metric

**Export**:
The action of transforming a selection of Folders, Entries, and Descriptions into an external file format (e.g., Anki, JSON).
_Avoid_: Flashcard, Deck, Sync (when referring to file output)

**Sync**:
The automated, bidirectional replication of private local data across a single user's devices (powered by libSQL/Turso).
_Avoid_: Publish, Upload, Social Sync

**Mirroring**:
The automated, unidirectional background process that pushes a user's shared data (folders, activity stats) from their local database to the central server so it can be viewed by others.
_Avoid_: Social Sync, Publishing, Broadcasting
