# Contracts & Interfaces: [DOMAIN_NAME]

**Parent Module**: [domain.md](./domain.md)

<!--
  ACTION REQUIRED: Define the boundaries of this module. How does the rest of the application interact with it?
-->

## Hexagonal Ports (`packages/core/ports`)

<!--
  Define the interfaces the core domain uses to talk to the outside world.
-->

- `[PORT_NAME]`: [Description, e.g., `CaptureRepositoryPort` - defines `save()`, `findById()`, `delete()`.]

## Core Services (`packages/core/services`)

<!--
  Define the use cases exposed by the domain to the primary adapters (clients).
-->

- `[SERVICE_NAME]`: [Description, e.g., `CaptureService` - exposes `createCapture()`, enforcing domain validation.]

## API Endpoints (`apps/server`)

<!--
  If this domain exposes a REST/GraphQL API.
-->

- `[HTTP_METHOD] [ENDPOINT_PATH]`: [Description, e.g., `POST /api/captures/sync` - Accepts sync payloads.]

## Client Hooks/Methods

<!--
  How the UI components interact with the domain.
-->

- `[HOOK_OR_METHOD_NAME]`: [Description, e.g., `useAddCapture()` mutation.]
