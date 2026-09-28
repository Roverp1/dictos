# Domain: Description Generation

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: Sep 25, 2026

## Module Responsibility

Description Generation creates typed Descriptions from one selected Description, an Instruction, a Provider Connection, and a Model. It is a Command Client-only feature. The TUI, Web client, and shared React package do not provide Description Generation state or interface, and the central server is not involved in provider requests.

## Core Workflows

### Manage Instructions

Instructions are reusable user-authored directives. An Instruction has required non-empty text and an optional name. A supplied name cannot be empty. Instructions are selected by ID and can be created, listed, updated, cleared of a name, and deleted through the Command Client.

### Manage Provider Connections and Models

Provider Connections are device-local configurations for external Models. A connection has a name, a preset or custom endpoint, and an API key entered through a hidden terminal prompt. The safe connection shape excludes the API key from normal lists, output, and logs. Built-in presets cover OpenAI, OpenRouter, DeepSeek, and Groq; secure custom endpoints without URL-embedded credentials and local development endpoints are also supported.

The Command Client discovers Models from a selected Provider Connection when its `/models` endpoint is supported. Discovery failure does not prevent manual Model identifier input for Description Generation. Models are selected for each generation command and are not stored as defaults.

### Create and Commit a Proposal

1. The Command Client requests a proposal from a source Description, Instruction, Provider Connection, Model, and one or more Description Types.
2. The service loads the source Entry and existing Senses as context, calls the generation adapter once, and validates the returned in-memory proposal. This phase writes nothing.
3. If the source Description already belongs to a Sense, generated Descriptions are proposed for that Sense. Otherwise, the proposal contains a new Sense name and may identify a suspected duplicate Sense.
4. A suspected duplicate is displayed before persistence. The user can create the duplicate, discard the proposal, or pre-authorize creation with `--allow-duplicate`. Discarding changes nothing.
5. Commit rechecks the source Description and persists the new or existing Sense target, source assignment when needed, and all generated Descriptions atomically.

## Rules and Boundaries

- Generated Descriptions are additive. Description Generation never replaces, rewrites, merges, or deletes existing Descriptions.
- Successful proposals cover every requested Description Type. They may include multiple Descriptions of the same type.
- A source Description without a Sense joins the newly created Sense without changing its text or Description Type.
- A duplicate candidate is a proposal state, not a failure. A user must decide before a duplicate is written.
- Provider failures, malformed output, validation failure, and stale proposals write no partial Dictionary data. One adapter invocation may make an initial provider request plus at most two AI SDK retries for retryable failures; core and the Command Client do not retry generation. Non-retryable failures receive one request. Description Generation does not stream output.
- Provider Connections are not synced. Their API keys never enter the Dictionary database, central server, normal CLI output, or logs.
- Expected AI SDK compatibility warnings are sanitized into structured logs instead of being written to command output.

## Related Documents

- [Data Model & State](./data-model.md)
- [Interfaces & Contracts](./contracts.md)
- [ADR 0008: Use AI SDK for Description Generation](../../adr/0008-use-ai-sdk-for-description-generation.md)
- [ADR 0009: Keep Provider Credentials Device-Local](../../adr/0009-keep-provider-credentials-device-local.md)
