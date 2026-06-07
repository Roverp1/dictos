# Specification: Web Client Initialization

**Status**: Draft | **Created**: 2026-05-24

## 1. The Problem (Why are we doing this?)

Currently, Dictos only exists as a Terminal User Interface (TUI). While powerful for developers and power users, a TUI creates a high barrier to entry for the general public who expect seamless, graphical experiences accessible from any device.

To expand the user base and fulfill the vision of a cross-platform application, Dictos needs a web-based client. This client must maintain the core "local-first" philosophy and utilize the existing Hexagonal Architecture (specifically the headless `@dictos/react` package) while adapting to the unique constraints and capabilities of the browser environment. Furthermore, the current monorepo structure bundles Node.js-specific infrastructure dependencies (like the file system) into a single adapter package, which prevents these packages from being safely imported into a browser build.

## 2. The Solution (What are we building?)

We will initialize a new Single Page Application (SPA) for the web platform and restructure the underlying infrastructure adapters to support it.

The web client will provide the same core functionality as the TUI but within a standard browser interface. It will use the exact same headless React logic as the TUI. To achieve local-first performance in the browser, it will persist data using a Turso Database (formerly Limbo), with @tursodatabase/sync-wasm driver. Device-specific data (like session IDs) will be stored in standard browser LocalStorage.

To enable this without crashing the browser build, we will dismantle the existing monolithic adapter package, splitting database, HTTP, logging, and storage adapters into their own isolated packages so the web client only imports browser-safe infrastructure.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Initial Load**
  When a user navigates to the Dictos web application URL, the application initializes its local WASM database and loads device-specific session data from LocalStorage before rendering the main Dictionary view.
- **Scenario: Seamless Navigation**
  As the user clicks between different views (e.g., from the Dictionary to an Entry detail view), the navigation is instantaneous, powered `@dictos/react` state logic.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] We are NOT building the entire Dictos UI in this phase; the goal is structural initialization, dependency unblocking, and rendering a basic entry point that proves the database and headless logic work in the browser.
- [ ] We are NOT implementing user authentication flows in the UI during this phase.
- [ ] We are NOT configuring deployment pipelines (e.g., Vercel, Netlify) in this specific feature ticket.

## 5. Success Criteria (How do we know we are done?)

- [ ] The `packages/adapters` monolith is successfully split into isolated packages (`db-core`, `bun-turso-sync`, `wasm-turso-sync`, `eden-http`, `fs-storage`, `local-storage`, `pino-logger`).
- [ ] The existing TUI application continues to compile, run, and pass tests using the newly separated adapter packages.
- [ ] A new Vite/React SPA application exists in `apps/web`.
- [ ] The web application compiles successfully without any Node.js built-in module errors.
- [ ] The web application successfully initializes a Turso WASM database and can read/write data to it in the browser.

## 6. Assumptions

- We assume Vite with React Router configured strictly as a client-side library (no SSR framework features) is the optimal build toolchain for the SPA.
- We assume the existing `@dictos/react` headless logic is entirely decoupled from Node.js APIs and will run cleanly in the browser.
