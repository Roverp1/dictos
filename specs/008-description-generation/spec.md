# Specification: Description Generation

**Status**: Draft | **Created**: Aug 19, 2026

## 1. The Problem (Why are we doing this?)

Descriptions are currently flat text attached directly to an Entry. The app cannot distinguish a translation from a definition or example, and it cannot represent that one Entry may have several distinct interpretations. Users can save a quick Description, but there is no durable way to group the definitions, translations, and examples that explain the same interpretation. This limits filtering and leaves future Anki Export without a reliable unit for creating one coherent note.

Writing those Descriptions manually is also slow. Dictos has the beginnings of Instruction and model-generation concepts, but they were created before the product language and architecture were settled and do not form a usable workflow. Users cannot connect their preferred model provider, select a Model, apply a reusable Instruction to an existing Description, or receive validated typed Descriptions.

The generation workflow must preserve Dictos's quick-save behavior. A user should still be able to save an Entry and an unstructured Description without stopping to organize it. Later, that Description should become context for generation without losing or silently rewriting the user's original text. Provider differences, malformed responses, and suspected duplicate Senses must not leave half-written Dictionary data.

## 2. The Solution (What are we building?)

Dictos will introduce Sense as the named interpretation of an Entry that groups related Descriptions. Every Description receives one of four fixed Description Types: `misc`, `translation`, `definition`, or `example`. A Description may remain directly attached to its Entry without a Sense, preserving quick saves, or join a Sense with other Descriptions. Multiple Descriptions of the same type may belong to one Sense. One Sense is the future unit for one Anki note, although Anki field arrangement is deferred.

The Command Client will let users manage Senses, typed Descriptions, reusable Instructions, Provider Connections, and Models. A Provider Connection remains device-local. Users can choose a known provider, configure a custom compatible endpoint, discover available Models when supported, and enter a Model identifier manually when discovery is unavailable or incomplete.

Description Generation starts from a selected Description, an Instruction, selected output types, a Provider Connection, and a Model. If the selected Description already belongs to a Sense, generated Descriptions are appended to that Sense. If it has no Sense, generation proposes a new named Sense, uses the source Description as context, and appends the generated Descriptions only after the complete proposal is valid. The source Description then joins the new Sense without changing its text or type.

When model during generation suspects that a proposed Sense duplicates an existing Sense for the Entry, the Command Client shows the generated proposal and the candidate existing Sense before writing anything. The user may create the duplicate or abandon the operation. Generated output is always additive in this iteration; generation never replaces or rewrites an existing Description.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Save a quick Description**
  Given the user wants to capture context without organizing it, when they create a Description without selecting a type or Sense, then Dictos saves it with type `misc` and no Sense.

- **Scenario: Manage typed Descriptions and Senses manually**
  Given an Entry has one or more Descriptions, when the user creates or renames a Sense, changes a Description Type, or assigns or detaches a Description, then Dictos preserves the rule that the Sense and Description belong to the same Entry. The user may keep multiple Descriptions of the same type in one Sense.

- **Scenario: Delete a Sense without deleting its Descriptions**
  Given a Sense contains Descriptions, when the user deletes it without requesting a cascade, then Dictos deletes the Sense and detaches its Descriptions. Their text and Description Types remain unchanged.

- **Scenario: Delete a Sense and its Descriptions**
  Given a Sense contains Descriptions, when the user explicitly requests cascading deletion, then Dictos deletes the Sense and all Descriptions assigned to it as one operation. The default remains preservation.

- **Scenario: Manage Instructions**
  Given the user has generation preferences such as language level, tone, or learning goal, when they create an Instruction, then it can be listed, edited, selected for generation, and deleted through the Command Client.

- **Scenario: Connect a known provider**
  Given Dictos recognizes a provider, when the user creates a Provider Connection, then Dictos supplies the known endpoint and securely prompts for the credential instead of accepting it as a command argument. The connection is stored only on the current device.

- **Scenario: Connect a custom provider**
  Given a provider exposes a compatible endpoint but has no built-in preset, when the user supplies a connection name, endpoint, and credential, then the Provider Connection can be used like a known provider.

- **Scenario: Select a Model**
  Given a Provider Connection is configured, when the user asks to list Models, then Dictos attempts live discovery. If discovery is unavailable or incomplete, the user can provide a Model identifier manually and continue generation.

- **Scenario: Generate a new Sense from a quick Description**
  Given the selected source Description has no Sense, when the user selects an Instruction, Provider Connection, Model, and one or more Description Types, then Dictos uses the Entry, source Description, and existing Senses as context. It generates a named Sense and one or more Descriptions covering every selected type. Once the proposal is valid and not flagged as a duplicate, Dictos creates the Sense, assigns the source Description to it, and saves all generated Descriptions as one operation.

- **Scenario: Generate into an existing Sense**
  Given the selected source Description already belongs to a Sense, when generation succeeds, then Dictos reuses that Sense and appends the generated Descriptions. Existing Descriptions remain untouched, including Descriptions with the same type.

- **Scenario: Confirm a suspected duplicate Sense**
  Given generation identifies an existing Sense as a likely duplicate, when the proposal returns, then the Command Client displays the candidate Sense and generated proposal and asks whether to create the duplicate or discard the proposal. No Dictionary data changes before the user accepts. Scripted callers may explicitly allow duplicates in advance.

- **Scenario: Abandon a suspected duplicate**
  Given the user rejects a duplicate proposal, when the command finishes, then the proposed Sense and generated Descriptions are discarded and the source Description remains unchanged and unassigned.

- **Scenario: Generation fails or returns malformed output**
  Given a provider request still fails after at most two AI SDK retries or the response does not match the required proposal shape, when Dictos handles the result, then the command reports a clear failure and writes no Sense, Description, or assignment. Core and the Command Client do not issue additional generation requests.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] No Description Generation interface for the TUI, Web, Mobile, or shared React package in this iteration.
- [ ] No Anki Export behavior or field-arrangement changes; only the future one-Sense-to-one-note boundary is established.
- [ ] No replacement, regeneration-in-place, or automatic deletion of existing Descriptions.
- [ ] No generation provenance, history, token usage, cost tracking, or persisted raw provider responses.
- [ ] No free-form or user-defined Description Types beyond `misc`, `translation`, `definition`, and `example`.
- [ ] No option to merge generated Descriptions into an existing suspected duplicate Sense.
- [ ] No application-level, unbounded, or non-retryable model-request retries. The adapter permits at most two AI SDK retries for retryable provider failures. Streaming generation remains out of scope.
- [ ] No bundled provider/model catalog or dependency on a runtime catalog service.
- [ ] No syncing of provider credentials or storage of those credentials in the Dictionary database or central server.
- [ ] No native provider protocols outside the initially supported compatible provider interface.
- [ ] No guarantee that concurrent offline generation on different devices cannot create semantically duplicate Senses after Sync.
- [ ] No backward compatibility requirement for the existing unshipped Instruction and LLM generation artifacts.

## 5. Success Criteria (How do we know we are done?)

- [ ] Every Description has exactly one of the four fixed Description Types, with `misc` used when no type is selected.
- [ ] A user can create, list, rename, and delete Senses through the Command Client.
- [ ] A user can assign a Description to a Sense from the same Entry and detach it again.
- [ ] Dictos rejects attempts to assign a Description to a Sense belonging to another Entry.
- [ ] A Sense can contain multiple Descriptions of the same type.
- [ ] Deleting a Sense preserves and detaches its Descriptions by default.
- [ ] Explicit cascading Sense deletion removes its assigned Descriptions as one operation.
- [ ] A user can create, list, edit, select, and delete reusable Instructions through the Command Client.
- [ ] A user can configure, list, update, and remove device-local Provider Connections without exposing credentials in command arguments or normal output.
- [ ] Known provider presets supply connection details, while custom compatible endpoints remain configurable.
- [ ] A user can discover Models from a supporting Provider Connection and manually enter a Model identifier when discovery is unavailable.
- [ ] A user can generate every selected Description Type from an existing source Description using a selected Instruction, Provider Connection, and Model.
- [ ] Generation from an unassigned source creates one Sense, assigns the source to it without changing its text or type, and saves all generated Descriptions together.
- [ ] Generation from a source with a Sense reuses that Sense and only appends Descriptions.
- [ ] Existing Descriptions are never replaced or modified by generation.
- [ ] A suspected duplicate proposal identifies the candidate existing Sense and requires accept-or-discard confirmation before persistence.
- [ ] Accepting a suspected duplicate creates a distinct Sense using the already-generated proposal without another model request.
- [ ] Rejecting a suspected duplicate leaves all Dictionary data unchanged.
- [ ] Provider failures, malformed responses, and validation failures leave all Dictionary data unchanged and return actionable errors.
- [ ] Provider credentials remain device-local and are not included in Sync.

## 6. Assumptions

- [ ] Sense names are required, user-editable text set when the Sense is created; exact duplicates are allowed.
- [ ] Sense identity, not repeated name text, groups Descriptions.
- [ ] Descriptions retain direct Entry ownership even when they also reference a Sense.
- [ ] Existing Senses and their Descriptions are supplied as generation context when checking a proposed new Sense for duplication.
- [ ] Duplicate detection returns a candidate existing Sense or no candidate; model-reported confidence percentages are not used.
- [ ] Each selected Description Type appears at least once in a successful proposal, and an Instruction may request multiple Descriptions of a selected type.
- [ ] Provider and Model selection happens for each generation command; a default selection is not required in this iteration.
- [ ] Credentials are entered through a secure terminal prompt and stored in an owner-only device-local file.
- [ ] The generation command may prompt interactively only when a duplicate decision is required; scripted usage can pre-authorize duplicate creation.
- [ ] The current unshipped Instruction and LLM generation code may be replaced or deleted when it conflicts with this specification.
- [ ] Sense-to-Anki-note mapping is a stable future boundary, while exact Description-to-field arrangement remains undecided.
