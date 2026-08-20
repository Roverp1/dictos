# Contracts & Interfaces: Description Generation

**Parent Module**: [domain.md](./domain.md)

## Core Services and Ports

- `InstructionService` and `InstructionRepository` manage reusable Instructions with optional names.
- `ProviderConnectionService` resolves presets and custom endpoints, manages safe Provider Connection records, and coordinates Model discovery.
- `ProviderConnectionRepository` stores credential-bearing connections only in device-local storage. `findAll()` returns redacted connection records; `findById()` is reserved for internal operations needing a credential.
- `ProviderPresetCatalog` exposes static Provider preset metadata. It is not a Model catalog.
- `ModelDiscoveryPort` lists sorted, unique Model identifiers for one credential-bearing Provider Connection.
- `DescriptionGenerationPort` accepts trusted generation context and returns a validated generated proposal or a Description Generation Error value.
- `DescriptionGenerationService.createProposal()` loads context and validates semantic rules without writing. `commitProposal()` delegates persistence to `DescriptionGenerationRepository`.
- `DescriptionGenerationRepository.commitProposal()` owns the database transaction. It rechecks source and target identity before writes, then creates or reuses the Sense, assigns the source when required, and inserts every generated Description together.

## Adapter Boundaries

`@dictos/ai-sdk` implements Model discovery and Description Generation for OpenAI-compatible providers. The Description Generation adapter creates an AI SDK compatible provider with `supportsStructuredOutputs: false`, makes one non-streaming `generateText()` request using object output, and validates the result before returning it to core. It accepts injected `fetch` for provider-boundary tests. It does not retry, stream, persist data, or decide duplicate acceptance.

The Model discovery adapter requests the selected connection's `/models` endpoint with its credential, validates the response, and returns sorted unique IDs. A user may supply a Model identifier without discovery.

The Command Client owns command parsing, hidden API-key input, duplicate confirmation, output, and exit codes. `--allow-duplicate` commits the already-created proposal and does not issue a second model request.

## Failure and Transaction Rules

Expected failures cross boundaries as Error values. Core and adapters return typed Error unions rather than using exceptions for normal failures. Generation, invalid-response, Model-discovery, storage, validation, missing-record, database, and stale-proposal failures remain distinguishable to callers.

Provider boundary errors are sanitized. API keys, Authorization headers, request objects, raw provider responses, and credential-bearing connection records must not be returned, logged, or printed.

The proposal phase has no writes. The commit adapter runs all writes in one database transaction; if a write fails, the Sense creation, source assignment, and generated Description inserts roll back together.
