# Phase 0: Research & Decisions

## Backend Framework: ElysiaJS
- **Decision**: Use ElysiaJS for the central backend server.
- **Rationale**: Bun-native performance, excellent TypeBox integration for validation, and the Eden Treaty for end-to-end type safety without code generation.

## Communication & Type Safety: Eden Treaty
- **Decision**: Abandon manual `API_ROUTES` maps in favor of Eden Treaty.
- **Rationale**: Allows the TUI client to import the server's type signature directly, providing full type safety for all endpoints with zero maintenance overhead.

## Database Architecture: Dual libSQL Architecture
- **Decision**: Use libSQL (Turso) for both personal databases and the central shared database.
- **Rationale**: Keeps the tech stack unified. Personal data uses native sync; central data uses API-mediated outbox sync.

## Synchronization Mechanism: Native + Outbox
- **Decision**:
  1. Use **Native Turso Sync** for personal data.
  2. Use the **Outbox Pattern** to sync shared data (activity aggregates) via REST API.
- **Rationale**: Personal data requires full bidirectional sync; central data requires secure, server-side aggregation.

## Security: Native Bun Hashing
- **Decision**: Use `Bun.password` (Argon2/Bcrypt) for password hashing.
- **Rationale**: Replaces Scrypt for better performance and zero-dependency integration with the Bun runtime.

## Error Handling: Errors as Values
- **Decision**: Use the `errore` library across the stack.
- **Rationale**: Services return tagged errors; Controllers translate them to HTTP status codes. Ensures explicit error handling in the domain logic.
