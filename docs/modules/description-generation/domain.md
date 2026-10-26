# Domain: Description Generation

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Oct 26, 2026

## Module Responsibility

Description Generation creates typed Descriptions from a saved source Description and reusable Instruction, or from unsaved Entry text, an optional captured Description, and inline Instruction text. Both paths require an eligible Model and configured Provider Connection. The screen overlay uses the Command Client for Sense suggestions, unsaved drafts, and reviewed saves. The TUI, Web client, and shared React package do not provide a generation interface; the central server is not involved in provider requests.

## Core Workflows

### Manage Instructions

Instructions are reusable user-authored directives. An Instruction has required non-empty text and an optional name. A supplied name cannot be empty. Instructions are selected by ID and can be created, listed, updated, cleared of a name, and deleted through the Command Client.

The overlay copies a saved Instruction's text into its input. Editing that copy never creates or updates a database Instruction. Inline text may be blank; the adapter still supplies task and JSON guidance. The last input text and selected Description Types are remembered in overlay-local storage, including after cancellation.

### Manage Provider Connections and Models

`dictos provider available` lists supported Provider IDs whether or not they are configured. `dictos provider connect <provider-id>` creates one device-local Provider Connection per supported ID; `dictos provider reconnect <provider-id>` explicitly replaces its API key, `dictos provider list` shows configured IDs, and `dictos provider disconnect <provider-id> --yes` removes one. Connect does not overwrite an existing credential, reconnect requires an existing connection, and connect without an ID shows a usage error rather than a picker. API keys enter through hidden terminal input, not CLI flags. A configured connection does not prove account access. `dictos auth` remains for Dictos account authentication.

Dictos routes native `openai` and `google` through their respective AI SDK adapters. `openrouter`, `deepseek`, and `groq` use OpenAI-compatible adapters with fixed Dictos-owned endpoints. The Model Catalog never supplies execution URLs, headers, or SDK packages. Custom Providers and endpoints, local development endpoints, provider OAuth and subscription sign-in are deferred.

`dictos models [provider-id] [--refresh] [--verbose]` lists eligible Models for configured Providers as sorted qualified `provider/model` IDs. An optional Provider ID filters the list; verbose output adds safe name, status, and known input/output costs. Model IDs are split at the first slash, so the provider-specific part may contain slashes. Eligibility requires a supported Provider route, a catalog-listed Model with text input and text-only output, a non-deprecated status, at least one upstream text-generation signal (`temperature`, `tool_call`, or `structured_output`), and no unsupported model-level protocol override. Text modalities alone are insufficient because models.dev also lists embedding-only Models as text-in/text-out. The picker offers eligible Models, and generation rejects unknown, unlisted, or ineligible choices even when configuration names one as its default. Catalog membership does not verify credentials, account entitlement, quota, or successful generation.

The Model Catalog ships with a bundled models.dev snapshot for offline listing. Normal reads prefer a validated device-local cache, fall back to the bundled snapshot if the cache is missing or invalid (with a warning for invalid cache), and do not contact provider `/models` endpoints or refresh automatically. `--refresh` explicitly fetches and validates the supported slice from models.dev before atomically replacing the cache; failure reports an error and leaves the last good data intact. The CLI prints the catalog source and retrieval date separately from Model IDs so users can judge staleness; metadata may be out of date even when listing succeeds, with no automatic age-based refresh. An eligible new Model becomes selectable after a successful refresh.

The configured Default Model initializes a Selected Model for each command or client workflow. `dictos description generate <description-id> --instruction <instruction-id> --types <type,...> [--model <provider/model>] [--allow-duplicate]` uses its resolved Default Model unless `--model` supplies an explicit invocation-only choice. Neither choice changes configuration or saves a device-wide selection. With neither, generation asks for configuration or `--model` before a Provider request. A syntactically valid but unavailable default does not block a valid explicit override. The `model select` and `model current` commands are unavailable.

Configuration validates the qualified ID's shape, not catalog eligibility or Provider access. Generation checks the Selected Model and connection when used; an unavailable, ineligible, disconnected, or Provider-rejected choice fails without fallback. Disconnecting a Provider only removes its credential and leaves configuration unchanged. Provider and catalog commands use device-local storage without opening the Dictionary database. Saved-Description generation uses the database; overlay suggestions and draft generation use only the provider graph.

Each Overlay opening resolves shared → CLI → Overlay configuration once and initializes its Selected Model from that Default Model, if present. Picker changes affect only that opening, and each suggestion or generation request carries the current qualified Model ID explicitly. Concurrent openings keep independent choices; reopening, including after Cancel, starts from the configured default. Changing the Selected Model preserves editor text and invalidates pending suggestions and generation so late replies cannot overwrite current work.

The opening's immutable configuration snapshot also governs its CLI subprocesses, including Model/Instruction listing, Save, and direct state helpers. File edits apply to the next opening; children retain the inherited CLI logging level and do not reread configuration or reapply live environment overrides. Manual editing and reviewed saving require neither a usable Model nor a database Instruction, but command operations still require valid configuration. File locations, scopes, initialization, and precedence are defined in the [configuration reference](../../configuration.md).

### Generate from a Saved Description

1. The Command Client initializes the Selected Model from an explicit `--model` or the resolved Default Model, then requests a proposal from a source Description, Instruction, its configured Provider Connection, the eligible Model, and one or more Description Types.
2. The service rechecks Model eligibility and the Provider Connection, loads the source Entry and existing Senses as context, calls the generation adapter once, and validates the returned in-memory proposal. This phase writes nothing.
3. If the source Description already belongs to a Sense, generated Descriptions are proposed for that Sense. Otherwise, the proposal contains a new Sense name and may identify a suspected duplicate Sense.
4. A suspected duplicate is displayed before persistence. The user can create the duplicate, discard the proposal, or pre-authorize creation with `--allow-duplicate`. Discarding changes nothing.
5. Commit rechecks the source Description and persists the new or existing Sense target, source assignment when needed, and all generated Descriptions atomically.

### Suggest Senses and Generate Unsaved Drafts

1. Supply nonblank Entry text, optional captured Description text, inline Instruction text, and the Selected Model. No saved Entry, Description, or Instruction ID is required.
2. Suggest Senses returns up to 20 distinct names with short `definition` previews. Captured Description context guides the suggestions when present. Previews are not saved Descriptions and are not automatically inserted into drafts.
3. Generate takes an optional Sense name, current typed drafts as context, and selected Description Types. It requests every selected Type, even when a draft of that Type already has text. It preserves a supplied Sense or proposes a name when blank. The result covers every requested Type and may contain multiple Descriptions of one Type.
4. Review and edit the draft before an explicit Save. Suggesting, choosing a Sense, and generating write no Dictionary records and do not open the Dictionary database.

### Review Overlay Drafts

Choosing a suggested Sense fills the Sense field and starts generation as one undoable action. It retains every Description card's key and Type and all manually entered or edited text. Only unedited generated text from the previous Sense is cleared. New output fills existing empty slots of each Type before adding cards, preserves same-Type card order, and appends when manual text fills every slot. Definition previews are never inserted automatically.

Explicit Generate captures nonempty draft text as request context, then clears and replaces all drafts of checked Types, including manual edits. It retains unchecked Types and the captured center Description and remains available when all checked Types have text. Undo restores the previous draft even after failure. Redo reuses a completed result or waits for its pending request; inactive replies cannot overwrite the active draft. This history belongs to the current overlay session and is separate from text-editor undo.

### Save Reviewed Text

`ScreenEntrySaveService` validates current editor text and calls `ScreenEntrySaveRepository.commit` for an atomic save in the root Folder. Save Entry writes the Entry and optional unassigned `misc` Description, ignoring the Sense and typed drafts. Save Sense writes a new named Sense and every nonempty typed Description; `includeDescription` also attaches the captured text as `misc` to that Sense. A Sense save requires at least one nonempty typed Description. It reuses an Entry's existing identity but never silently reuses a same-named Sense.

Save does not call a Provider or require a generation proposal. A valid success receipt allows the overlay to exit after flushing local state; a handled failure preserves drafts. An unreadable response, contradictory receipt, or child-process crash leaves the save outcome unknown, so the client retains drafts and avoids automatic retry.

## Rules and Boundaries

- Description Generation never rewrites or deletes saved Descriptions. Explicit Generate can replace unsaved overlay drafts of checked Types.
- Successful proposals cover every requested Description Type. They may include multiple Descriptions of the same type.
- In saved-Description generation, a source Description without a Sense joins the newly created Sense without changing its text or Description Type.
- A suspected duplicate in a saved-Description proposal requires a user decision before persistence. Screen Sense suggestions carry no existing Sense IDs or duplicate decisions.
- Provider failures, malformed output, validation failure, and stale proposals write no partial Dictionary data. One adapter invocation may make an initial provider request plus at most two AI SDK retries for retryable failures; core and the Command Client do not retry generation. Non-retryable failures receive one request. Description Generation does not stream output.
- Provider Connections, the Model Catalog cache, and configuration files are device-local, outside Sync and Mirroring. The Selected Model exists only for its command or workflow and is never persisted. Credentials are stored in an owner-only file; safe connection results and lists expose only the Provider ID. API keys, authorization headers, and raw provider responses never enter the Dictionary database, central server, normal CLI output, or logs.
- `@dictos/config` owns portable setting definitions, validation, defaults, resolution, provenance, and snapshots. `@dictos/fs-storage/configuration` owns native discovery, TOML decoding, and missing starter-file creation. Core receives explicit Model inputs and remains configuration-free.
- Configuration failures stop the requested operation with exit `5` and `CONFIGURATION_ERROR` in JSON output. The safe error message identifies the source, setting, available location, and reason; a nonempty list of structured issues adds detail. The launcher reports startup failures before capture/OCR, and an open Overlay displays child failures as Notifications while retaining drafts.
- Expected AI SDK compatibility warnings are sanitized into structured logs instead of being written to command output.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
- [Configuration reference](../../configuration.md)
- [ADR 0008: Use AI SDK for Description Generation](../../adr/0008-use-ai-sdk-for-description-generation.md)
- [ADR 0009: Keep Provider Credentials Device-Local](../../adr/0009-keep-provider-credentials-device-local.md)
- [ADR 0010: Use Catalog-Backed Provider IDs](../../adr/0010-use-catalog-backed-provider-ids.md)
- [ADR 0011: Keep the Model Catalog Out of Provider Execution](../../adr/0011-keep-catalog-out-of-provider-execution.md)
- [ADR 0012: Use a Standalone Screen Review Client](../../adr/0012-use-a-standalone-screen-review-client.md)
- [ADR 0013: Keep Configuration Portable and Snapshot Workflows](../../adr/0013-keep-configuration-portable-and-snapshot-workflows.md)
