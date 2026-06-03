# Domain: [DOMAIN_NAME]

**Parent**: [System Overview](../../system-overview.md) | **Last Updated**: [DATE]

<!--
  ACTION REQUIRED: This is the primary required document for a Documentation Module folder.
  It explains the functional reality, responsibilities, and workflows of this domain.
  For schemas and interfaces, see data-model.md and contracts.md in this folder.
-->

## Module Responsibility

[1-2 sentences on what this slice of the app handles. e.g., "Responsible for managing dictionary Captures, Definitions, and Directories, ensuring pure domain logic is isolated from database persistence."]

## Core Workflows

<!--
  ACTION REQUIRED: Provide step-by-step logic for complex operations.
-->

### [WORKFLOW_NAME] (e.g., Adding a Capture)

1. [e.g., The TUI application dispatches an action to the `CaptureService` in `packages/core`.]
2. [e.g., `CaptureService` validates the domain rules (e.g., name must not be empty).]
3. [e.g., `CaptureService` calls the `CaptureRepositoryPort` to persist the entity.]
4. [e.g., The concrete adapter in `packages/adapters/db` executes the SQL query.]

## Key Decisions & Trade-offs

<!--
  ACTION REQUIRED: When absorbing a feature plan, capture the "Why" here.
  Briefly summarize major architectural choices to preserve historical context.
-->

- **[Decision Name]**: [e.g., We chose an Outbox pattern over CRDTs because X. Implemented during `005-sync`.]

## Known Edge Cases & Constraints

- [e.g., "A Capture cannot be deleted if it contains Definitions. The UI must warn the user and cascade the deletion explicitly."]

## Related Documents

- [Data Model & State](./data-model.md) _(Optional)_
- [Interfaces & Contracts](./contracts.md) _(Optional)_
