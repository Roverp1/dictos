# Testing Boundaries via Integration and Contracts

When testing code that crosses boundaries (databases, network, file system), we favor integration tests over unit tests that rely heavily on mocks. Mocks should be reserved for external system boundaries (like 3rd-party web APIs), not used for internal databases or local infrastructure. For example, rather than mocking database queries, we test against real local database instances.

For core domain logic that is pure and has no I/O, we use fast, isolated unit tests.

When multiple adapters implement the same interface, we use shared contract scenarios where the runtime can execute them faithfully. Domain-port scenarios live in `@dictos/core/testing`; SQLite migration and schema scenarios live in `@dictos/db-core/testing`. These modules are runner-neutral. Each supported adapter supplies a fresh real-infrastructure harness and binds the cases to its native test runner.

Package-specific constraints may require a different verification boundary. `@dictos/wasm-turso-sync` depends on browser OPFS and deliberately has no package-local Vitest or Playwright runner. Its migration and Bun/WASM compatibility behavior must be verified through real cross-platform browser E2E tests instead. This exception avoids a second browser harness that is slower, harder to maintain, and less representative than the application environment.
