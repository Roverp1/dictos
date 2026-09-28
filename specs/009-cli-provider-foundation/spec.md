# Specification: CLI Provider Foundation

**Status**: Draft | **Created**: Sep 28, 2026

## 1. The Problem (Why are we doing this?)

Description Generation works in the Command Client, but Model selection relies on a small set of endpoint presets and an opaque Provider Connection ID. Users must supply that ID and a Model ID with every generation command. Listing Models makes a live request to one connection, so the choices depend on its listing endpoint and current availability.

The first provider integration is usable, but users cannot easily discover providers, compare Models, or keep using a chosen Model. The design also assumes every provider speaks the same protocol. Adding Google or the planned TUI provider picker this way would push provider-specific behavior into clients and could leave users with incomplete or misleading Model choices.

This feature establishes a CLI-first provider contract for multiple protocols under the same Description Generation rules. A later TUI feature can use the tested Command Client contract for native interactive workflows.

## 2. The Solution (What are we building?)

Dictos will identify supported providers by stable IDs such as `openai` and `google`, replacing endpoint presets and generated connection IDs. A Provider Connection remains device-local. Each provider ID has one configured connection and credential per device; users choose IDs for custom OpenAI-compatible endpoints. Provider information, saved credentials, and the selected Model remain separate.

The Command Client will use a locally available models.dev catalog for Model information. Users can list supported providers and their Models, refresh the catalog, and select a qualified `provider/model` ID. Catalog entries help with selection but do not prove account access. Users can supply Model IDs manually for custom endpoints or catalog gaps.

Description Generation will use the selected device-local Model unless the command supplies an override. Without a selection or override, generation cannot choose a provider or Model for the user. Native OpenAI and Google support, along with supported OpenAI-compatible endpoints, must use the same validated proposal and commit workflow. The Command Client is the only Description Generation interface in this feature.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Find and connect a provider**
  Given a new local installation, when the user lists supported providers, then the Command Client shows configurable provider IDs without requiring a Dictos account or a connection to the Dictionary database. When they connect `google` by ID, Dictos prompts for an API key through hidden terminal input and saves it on this device. The connect command without an ID shows usage guidance instead of a provider picker. Listing Provider Connections shows which IDs have credentials configured without displaying credentials or claiming account verification.

- **Scenario: Configure a custom endpoint**
  Given an OpenAI-compatible endpoint outside the supported provider list, when the user provides a unique provider ID, a secure endpoint URL, and an API key, then they can use that ID with the endpoint's exact Model IDs. They can add known Model IDs through the CLI so those IDs appear in Model listings, or supply an unlisted ID manually. Local development endpoints remain possible. Dictos rejects URLs containing credentials. Saving an endpoint does not establish that it supports Model listing or Description Generation.

- **Scenario: Browse Models**
  Given a configured provider, when the user runs `dictos models` or filters by provider ID, then the Command Client prints `provider/model` IDs in deterministic order from the locally available catalog and any custom Model IDs added through the CLI. A custom provider without listed Models can still use manually supplied IDs. Optional verbose output shows safe catalog metadata. Qualified IDs split at the first slash, allowing slashes in provider-specific Model IDs. Deprecated, unsupported, or unrelated catalog providers do not appear as usable Dictos Models. An unknown provider ID produces a clear error.

- **Scenario: Refresh while offline**
  Given a bundled or previously saved catalog, when the user lists Models without network access, then they can inspect the available data and see that it may be stale. If an explicit refresh cannot reach the catalog, Dictos reports the failure and keeps the last good data. Listing Models does not call every provider's `/models` endpoint or require a working API key.

- **Scenario: Choose a Model and generate Descriptions**
  Given a configured provider, when the user selects a `provider/model` ID, then Dictos saves the Model choice on the current device. The Command Client can show the current choice. When the user generates Descriptions from a source Description using an Instruction and one or more Description Types, the saved choice applies unless the command supplies another qualified Model ID. An override affects only that invocation. A future TUI can use the same choice on this device.

- **Scenario: No Model selected**
  Given no saved Model choice, when the user requests Description Generation without an explicit Model, then the command fails before contacting a provider or writing Dictionary data and tells the user to select a Model or supply an override. Dictos never chooses the first catalog Model automatically.

- **Scenario: Model not in the catalog**
  Given a configured provider whose Model is missing from the catalog, when the user supplies its exact Model ID, then Dictos accepts it as an unverified manual choice. An unsupported provider ID, malformed qualified ID, or missing Provider Connection is rejected before generation. If the provider rejects the Model, Dictos reports an actionable error without saving a partial proposal.

- **Scenario: Replace or remove a credential**
  Given an existing Provider Connection, when the user explicitly reconnects or replaces its API key, then Dictos updates only that provider's device-local credential without printing it. Connecting to an already configured provider never silently overwrites a key. Disconnecting removes its saved credential and clears its Model selection, if selected, without falling back to another provider. A script must explicitly authorize destructive removal.

- **Scenario: Preserve Description Generation rules**
  Given a supported OpenAI, Google, or OpenAI-compatible Model, when generation succeeds, then its proposal follows the existing Description Type coverage, Sense assignment, and additive persistence rules. A suspected duplicate Sense still requires acceptance or discard before writing. Provider rejection, malformed output, or a stale proposal leaves the Dictionary unchanged; accepted content is committed atomically. Generation remains non-streaming, with no client retry beyond the existing bounded provider retry policy.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] No TUI, Web, or Mobile provider setup, Model picker, Description Generation interface, Control Bar, Command Palette, or TUI settings in this feature. Those need a later specification.
- [ ] No OpenTUI library upgrade in this feature; upgrade and verify it before later TUI implementation.
- [ ] No provider OAuth, ChatGPT subscription sign-in, provider plugins, or support for every provider listed by models.dev.
- [ ] No universal live `/models` probe, guarantee of provider account entitlement, or promise that catalog pricing and capabilities are current.
- [ ] No Sync, Mirroring, central-server storage, or Dictionary database storage for Provider Connection credentials, catalog cache, or the selected Model.
- [ ] No migration or backward-compatibility layer for the current unshipped, test-only provider files or old provider CLI commands. Existing local test connections may need to be reconfigured.
- [ ] No change to Description Generation's additive behavior, Sense duplicate decision, atomic commit boundary, Description Types, or Export rules.
- [ ] Unattended tests do not require live provider credentials or a paid API. A real Gemini request can be checked manually when a suitable key and quota are available; free-tier eligibility is not guaranteed.

## 5. Success Criteria (How do we know we are done?)

- [ ] A CLI-only user can discover supported provider IDs, configure an API-key Provider Connection using an explicit ID, inspect connected IDs, select and inspect a device-local Model, and generate Descriptions without editing configuration files by hand.
- [ ] Supported provider IDs replace static endpoint presets and generated connection IDs in Model selection. `dictos models [provider]` returns stable, ordered `provider/model` IDs for configured, supported providers, while custom and uncataloged Model IDs remain usable by explicit selection.
- [ ] A bundled or cached catalog permits offline Model listing. A failed explicit refresh reports a failure and retains the last usable catalog; ordinary listing does not contact each provider to discover Models.
- [ ] The CLI accepts an explicit qualified Model ID for one generation command or uses the saved device-local choice. With neither choice available, it fails before any provider request or Dictionary write. Removing the selected provider invalidates the saved choice without choosing another.
- [ ] Native OpenAI and Google, plus supported OpenAI-compatible endpoints, each return the same validated proposal or a distinguishable, actionable failure through the Command Client. Catalog membership alone never bypasses provider or proposal validation.
- [ ] Existing OpenRouter, DeepSeek, and Groq API-key generation workflows remain usable alongside native OpenAI, native Google, and custom OpenAI-compatible endpoints.
- [ ] Existing duplicate confirmation, rejection without writes, and atomic persistence of accepted Descriptions remain effective regardless of provider.
- [ ] Provider, catalog, and selected-Model commands can run without opening the shared Dictionary database, including while another client has that database open. Generating Descriptions continues to use the normal Dictionary database boundary.
- [ ] API keys, credential-bearing records, authorization headers, raw provider responses, and secrets embedded in external errors do not appear in normal output, catalog output, returned user-facing errors, or logs. Device-local credentials retain owner-only protection.
- [ ] Deterministic tests cover catalog/cache/offline behavior, credential storage and redaction, command selection and failure paths, and generation through each supported provider protocol without relying on live network or credentials.

## 6. Assumptions

- [ ] A provider ID identifies one device-local Provider Connection; a user-defined custom endpoint gets its own provider ID. Multiple simultaneous credentials for the same provider ID are deferred.
- [ ] The selected Model is one device-local `provider/model` pair shared by the Command Client and a future TUI, not an account-wide or synced preference. CLI scripts needing a reproducible Model provide an explicit override.
- [ ] `dictos auth` keeps its existing meaning of Dictos account authentication. Provider credential commands remain separate, with API keys entered through a hidden prompt rather than command-line flags.
- [ ] The catalog is an aid to selection, not an authorization check. Only providers with a supported Dictos execution path appear as usable choices; manually supplied Model IDs remain possible for configured providers.
- [ ] This specification revises the provider presets, live-only Model discovery, per-command Model requirement, and Command Client-only provider assumptions in the earlier Description Generation specification. Other proposal and persistence rules still apply. Living Description Generation documentation and terminology are updated when the new contracts are implemented.
