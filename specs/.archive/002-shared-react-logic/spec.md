# Specification: Shared React Logic Package (@dictos/react)

**Status**: Draft | **Created**: 2026-06-03

## 1. The Problem (Why are we doing this?)

Currently, all React-related logic (state management, data fetching hooks, navigation flow) is tightly coupled within the `apps/tui/` directory. As Dictos expands to support Web and Mobile (React Native) platforms, maintaining this logic in a single app-specific directory would lead to massive code duplication or awkward cross-app imports.

Furthermore, the current implementation mixes platform-specific concerns (like TUI-specific keyboard bindings and icons) with core business logic. This makes it difficult to test the logic in isolation and slows down the development of new clients.

## 2. The Solution (What are we building?)

We are creating a new package, `@dictos/react`, that will act as a headless "Shared UI Logic" layer. This package will extract the React hooks and state management currently in the TUI app and make them available to any React-based client (TUI, Web, Mobile).

The package will use "Inversion of Control" via the React Context API to receive domain services (like `EntryService`, `FolderService`) from the host application. This allows the shared logic to remain agnostic of the underlying persistence layer (native SQLite vs. WASM SQLite vs. API).

## 3. User Experience (How does it work?)

From the perspective of a developer building a new Dictos client:

### Core Workflows

- **Scenario: Browsing the Dictionary**
  The developer uses the `useDictionary` hook from `@dictos/react`. This hook provides a list of `entries`, `folders`, and a unified `treeItems` list. The hook also provides handlers like `onNavigateIn(folderId)` and `onDelete(id)`. The developer is free to render these items using terminal components, HTML `div`s, or Native `View`s.

- **Scenario: Navigating Folders**
  When a user selects a folder, the shared logic updates the internal navigation state. If the app is a Web client, it can react to these state changes to update the browser URL. If it's a TUI client, it stays within its memory-based routing.

- **Scenario: Performing Actions**
  When a user requests to "Create Entry," the shared hook handles the interaction with the `EntryService` (provided via context). It manages the "loading" and "error" states, which the UI then renders according to platform standards (e.g., a TUI spinner or a Web progress bar).

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] **Auth Logic**: Session management and Auth pages are currently out of scope and will remain in the TUI app for now.
- [ ] **UI Components**: This package will NOT contain any visual components (no CSS, no TUI primitives).
- [ ] **Icons & Formatting**: TUI-specific characters (like ``) and platform-specific formatting stay in the host applications.
- [ ] **Platform Adapters**: Creating WASM-based or Web-specific database adapters is out of scope for this specific migration.

## 5. Success Criteria (How do we know we are done?)

- [ ] A new package `@dictos/react` exists in `packages/react`.
- [ ] The TUI app's "Dictionary" page logic is successfully migrated to use `@dictos/react`.
- [ ] The TUI app remains fully functional with no regressions in navigation or data management.
- [ ] `packages/react` depends only on platform-agnostic libraries (`react`, `react-router`, `zustand`, `@dictos/core`).

## 6. Assumptions

- [ ] We assume `zustand` and `react-router` are acceptable dependencies for all planned platforms.
- [ ] We assume that most "Dictionary" interactions (CRUD on entries/folders) follow a similar enough flow across platforms to justify a single shared hook.
