# Specification: Improve Adapters, Reliability, and Infrastructure

**Status**: Draft | **Created**: June 08, 2026

*(Note: Integration Testing components of this specification have been postponed to a future spec to expedite the merge of the adapter and infrastructure improvements).*

## 1. The Problem (Why are we doing this?)

As Dictos grows, maintaining the reliability of data synchronization and storage across different platforms is becoming increasingly difficult. Furthermore, the local development environment is prone to "it works on my machine" issues and requires cloud credentials to test core features.
- **Poor Observability**: There is no structured logging. Debugging depends on scattered `console.log` statements.
- **Fragile WASM Migrations**: The WASM client uses a manual, static string-based migration hack because it lacks access to the filesystem.
- **Friction in Development**: New developers must manually install correct versions of Node/Bun/Turso and supply real Turso Cloud credentials to boot the app, complicating onboarding.

## 2. The Solution (What are we building?)

We are refactoring the database adapters to be more robust and migrating the project to a reproducible, zero-friction Nix-based developer environment. The solution consists of three pillars:
- **Vite-Native WASM Migrator**: A custom migration engine for the web client that uses Vite's `import.meta.glob` to bundle Drizzle SQL migrations directly into the application.
- **Structured Logging**: Deep integration of the `@dictos/logger` into both adapters to provide high-fidelity traces.
- **Declarative Infrastructure**: Migration to `devenv.sh` for declarative dependency management, background process orchestration (including a local offline Turso sync server), and secure runtime secret injection.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Zero-Friction Onboarding**
  Given a new developer clones the repo, When they run `devenv shell`, Then they are immediately prompted to configure their local secrets provider if they haven't, and all required tools (Bun, Turso) are installed automatically.

- **Scenario: Offline Sync Development**
  Given a developer is working without internet access, When they run `devenv up`, Then the central server and web client start, and the central server seamlessly provisions a local sync database, allowing full push/pull testing without hitting the Turso Cloud Platform API.

- **Scenario: Seamless Web Migration**
  Given a new version of the web app with schema changes, When the user opens the app, Then the Vite-bundled migrations are automatically applied.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] We are NOT building automated integration tests in this phase; they are postponed.
- [ ] We are NOT building a generic migrator for all bundlers; the WASM solution is specifically optimized for Vite.
- [ ] We are NOT supporting backward compatibility for pre-migration-engine databases.

## 5. Success Criteria (How do we know we are done?)

- [ ] `wasm-turso-sync` applies migrations using standard Drizzle `.sql` files bundled via Vite.
- [ ] `bun-turso-sync` and `wasm-turso-sync` emit structured logs for all major operations.
- [ ] `devenv up` successfully orchestrates the frontend, backend, and local sync server.
- [ ] Developers can boot and sync the application locally without requiring `TURSO_PLATFORM_TOKEN` or `TURSO_ORG_SLUG` via mocked platform API calls.

## 6. Assumptions

- [ ] Assuming that Vite's `import.meta.glob` is available in the environment where `wasm-turso-sync` is consumed.
- [ ] Assuming that Turso's "last-write-wins" is the acceptable default conflict resolution strategy for all synced entities.
