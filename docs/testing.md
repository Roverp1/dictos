# Dictos Testing Strategy & Guidelines

## 1. Core Philosophy: Value Over Coverage

In this project, we prioritize **high-value, high-quality tests** over 100% test coverage.

A good test ensures reliability where it matters most (critical user flows, data integrity, syncing logic) without making the codebase hard to refactor. A test that breaks every time you rename an internal variable or split a private function is a _liability_, not an asset.

- **Test behavior, not implementation details.** Test what the code does for the user/caller, not how it organizes its internal functions.
- **Survive Refactoring:** If you rewrite the internals of a service without changing its public API or behavior, no tests should fail.
- **Quality > Quantity:** We do not maintain low-value tests for simple boilerplate, getters/setters, or purely structural code if they bring no confidence to the system's reliability.

## 2. Test at the Right Level

| Scenario                                              | Level                | Approach                                                                        |
| :---------------------------------------------------- | :------------------- | :------------------------------------------------------------------------------ |
| Pure logic, no I/O (parsers, domain math, CRDT logic) | **Unit Test**        | Fast, isolated.                                                                 |
| Crosses a boundary (DB, file system, network)         | **Integration Test** | Test against real local infrastructure (e.g., local Turso server). Avoid mocks. |
| Multiple adapters for one interface (Bun vs Wasm DB)  | **Contract Test**    | Write one shared test suite in `core`, import it into adapter tests.            |

## 3. Good vs. Bad Tests

### Good Tests (Behavioral / Integration)

Test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});

// GOOD: Verifies through interface (not raw SQL bypass)
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

Characteristics of a good test:

- Tests behavior users/callers care about.
- Uses the public API only.
- Describes WHAT, not HOW.
- One logical assertion block per test.

### Bad Tests (Implementation Details)

Coupled to internal structure. Break easily during refactoring.

```typescript
// BAD: Tests implementation details by mocking internal collaborators
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});

// BAD: Bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});
```

Red flags:

- Mocking internal collaborators instead of external uncontrollable boundaries.
- Testing private methods.
- Asserting on call counts/order (`toHaveBeenCalledTimes(1)`).
- Test name describes HOW not WHAT.
- Test breaks when refactoring without behavior change.
- Verifying through external means instead of interface.

## 4. Project-Specific Rules

### A. Colocation

Tests live exactly next to the file they are testing.
`SyncService.ts` -> `SyncService.test.ts`.

### B. "Errors as Values" Assertions

Dictos uses the `errore` package. We do not use `try/catch` in tests unless dealing with catastrophic panics. Instead, assert on the returned union.
We can `throw` the error, instead of doing `expect(res instanceof Error).toBe(false)`, so that typescript would automatically narrow the type.

```typescript
const result = await syncService.sync();
// Assert failure
if (result instanceof Error) throw result;

// Assert success
if (result instanceof Error) throw result;
expect(result).toEqual({ synced: true });
```

### C. Testing Turso Sync Locally

**DO NOT mock the Turso database.** For sync integration tests, programmatically spawn a local Turso sync server within the test suite setup.

```typescript
let server: Subprocess;
beforeAll(() => {
  server = spawn(["tursodb", dbPath, "--sync-server", `0.0.0.0:${port}`]);
});
afterAll(() => server.kill());
```

### D. The Prove-It Pattern for Bugs

When fixing a bug:

1. Write a test that demonstrates the bug (must FAIL with current code).
2. Confirm the test fails.
3. Fix the bug until the test passes.

## 5. Cover These Scenarios

For every function or component, ensure these boundaries are tested if applicable:

| Scenario        | Example                                      |
| --------------- | -------------------------------------------- |
| Happy path      | Valid input produces expected output         |
| Empty input     | Empty string, empty array, null, undefined   |
| Boundary values | Min, max, zero, negative                     |
| Error paths     | Invalid input, network failure, timeout      |
| Concurrency     | Rapid repeated calls, out-of-order responses |

## 6. General Test Rules

1. **Test behavior, not implementation details.**
2. **Each test should verify one concept.**
3. **Tests should be independent** — absolutely no shared mutable state between tests (crucial for our local DB integration tests).
4. **Avoid snapshot tests** unless you are actively reviewing every change to the snapshot visually.
5. **Mock at system boundaries** (uncontrollable external networks), not between internal functions or local infrastructure.
6. **Every test name should read like a specification.**
7. **A test that never fails is as useless as a test that always fails.**
