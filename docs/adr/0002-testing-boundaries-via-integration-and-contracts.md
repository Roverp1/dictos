# Testing Boundaries via Integration and Contracts

When testing code that crosses boundaries (databases, network, file system), we favor integration tests over unit tests that rely heavily on mocks. Mocks should be reserved for external system boundaries (like 3rd-party web APIs), not used for internal databases or local infrastructure. For example, rather than mocking database queries, we test against real local database instances.

For core domain logic that is pure and has no I/O, we use fast, isolated unit tests.

When multiple adapters implement the same interface for different environments (e.g., a `Bun` client and a `Wasm` client), we use Shared Contract Tests. The contract test suite is defined once in the core package, and all implementations import and run it. This guarantees identical behavior across environments without duplicating test code. If an adapter is unique and has no alternate implementations, standard integration tests are sufficient.
