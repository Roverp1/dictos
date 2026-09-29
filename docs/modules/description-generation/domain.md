# Domain: Description Generation

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Sep 29, 2026

## Module Responsibility

Description Generation creates typed Descriptions from one source Description, an Instruction, a Provider Connection, and a Model. It is a Command Client-only feature. The TUI, Web client, and shared React package do not provide Description Generation state or interface, and the central server is not involved in provider requests.

## Core Workflows

### Manage Instructions

Instructions are reusable user-authored directives. An Instruction has required non-empty text and an optional name. A supplied name cannot be empty. Instructions are selected by ID and can be created, listed, updated, cleared of a name, and deleted through the Command Client.

### Manage Provider Connections and Models

`dictos provider available` lists supported Provider IDs whether or not they are configured. `dictos provider connect <provider-id>` creates one device-local Provider Connection per supported ID; `dictos provider reconnect <provider-id>` explicitly replaces its API key, `dictos provider list` shows configured IDs, and `dictos provider disconnect <provider-id> --yes` removes one. Connect does not overwrite an existing credential, reconnect requires an existing connection, and connect without an ID shows a usage error rather than a picker. API keys enter through hidden terminal input, not CLI flags. A configured connection does not prove account access. `dictos auth` remains for Dictos account authentication.

Dictos routes native `openai` and `google` through their respective AI SDK adapters. `openrouter`, `deepseek`, and `groq` use OpenAI-compatible adapters with fixed Dictos-owned endpoints. The Model Catalog never supplies execution URLs, headers, or SDK packages. Custom Providers and endpoints, local development endpoints, provider OAuth and subscription sign-in are deferred.

`dictos models [provider-id] [--refresh] [--verbose]` lists eligible Models for configured Providers as sorted qualified `provider/model` IDs. An optional Provider ID filters the list; verbose output adds safe name, status, and known input/output costs. Model IDs are split at the first slash, so the provider-specific part may contain slashes. Eligibility requires a supported Provider route, a catalog-listed Model with text input and text-only output, a non-deprecated status, at least one upstream text-generation signal (`temperature`, `tool_call`, or `structured_output`), and no unsupported model-level protocol override. Text modalities alone are insufficient because models.dev also lists embedding-only Models as text-in/text-out. An unknown, unlisted, or ineligible Model cannot be selected or used, even if its ID could be sent to a provider. Catalog membership does not verify credentials, account entitlement, quota, or successful generation.

The Model Catalog ships with a bundled models.dev snapshot for offline listing. Normal reads prefer a validated device-local cache, fall back to the bundled snapshot if the cache is missing or invalid (with a warning for invalid cache), and do not contact provider `/models` endpoints or refresh automatically. `--refresh` explicitly fetches and validates the supported slice from models.dev before atomically replacing the cache; failure reports an error and leaves the last good data intact. The CLI prints the catalog source and retrieval date separately from Model IDs so users can judge staleness; metadata may be out of date even when listing succeeds, with no automatic age-based refresh. An eligible new Model becomes selectable after a successful refresh.

`dictos model select <provider/model>` saves one Selected Model on this device; `dictos model current` shows that choice or an unselected state. Selection requires an eligible Model and a configured Provider Connection. `dictos description generate <description-id> --instruction <instruction-id> --types <type,...> [--model <provider/model>] [--allow-duplicate]` uses the Selected Model unless `--model` supplies an eligible, configured one-command override; the override does not change the saved choice. With neither, generation fails rather than picking a Model. If a saved choice becomes stale or loses its connection, it fails rather than falling back. Disconnecting its Provider clears the matching selection before removing the credential, without selecting a replacement. Provider, catalog, and Model selection commands use device-local storage without opening the Dictionary database; generation uses the Dictionary database.

### Create and Commit a Proposal

1. The Command Client resolves the Selected Model or explicit override, then requests a proposal from a source Description, Instruction, its configured Provider Connection, the eligible Model, and one or more Description Types.
2. The service rechecks Model eligibility and the Provider Connection, loads the source Entry and existing Senses as context, calls the generation adapter once, and validates the returned in-memory proposal. This phase writes nothing.
3. If the source Description already belongs to a Sense, generated Descriptions are proposed for that Sense. Otherwise, the proposal contains a new Sense name and may identify a suspected duplicate Sense.
4. A suspected duplicate is displayed before persistence. The user can create the duplicate, discard the proposal, or pre-authorize creation with `--allow-duplicate`. Discarding changes nothing.
5. Commit rechecks the source Description and persists the new or existing Sense target, source assignment when needed, and all generated Descriptions atomically.

## Rules and Boundaries

- Generated Descriptions are additive. Description Generation never replaces, rewrites, merges, or deletes existing Descriptions.
- Successful proposals cover every requested Description Type. They may include multiple Descriptions of the same type.
- A source Description without a Sense joins the newly created Sense without changing its text or Description Type.
- A duplicate candidate is a proposal state, not a failure. A user must decide before a duplicate is written.
- Provider failures, malformed output, validation failure, and stale proposals write no partial Dictionary data. One adapter invocation may make an initial provider request plus at most two AI SDK retries for retryable failures; core and the Command Client do not retry generation. Non-retryable failures receive one request. Description Generation does not stream output.
- Provider Connections, the Model Catalog cache, and the Selected Model are device-local, not synced or mirrored. Credentials are stored in an owner-only file; safe connection results and lists expose only the Provider ID. API keys, authorization headers, and raw provider responses never enter the Dictionary database, central server, normal CLI output, or logs.
- Expected AI SDK compatibility warnings are sanitized into structured logs instead of being written to command output.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
- [ADR 0008: Use AI SDK for Description Generation](../../adr/0008-use-ai-sdk-for-description-generation.md)
- [ADR 0009: Keep Provider Credentials Device-Local](../../adr/0009-keep-provider-credentials-device-local.md)
- [ADR 0010: Use Catalog-Backed Provider IDs](../../adr/0010-use-catalog-backed-provider-ids.md)
- [ADR 0011: Keep the Model Catalog Out of Provider Execution](../../adr/0011-keep-catalog-out-of-provider-execution.md)
