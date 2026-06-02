# Specification: Turso Cross-Device Synchronization

**Status**: Draft

## 1. The Problem (Why are we doing this?)

Dictos is designed as a local-first application, which provides excellent privacy and zero-latency interactions. However, users currently have no way to back up their dictionaries or access their captures and folders across multiple devices. If a user creates entries on their laptop, they cannot seamlessly study them on their desktop. 

We need a robust, offline-capable synchronization strategy that allows users to maintain the speed and reliability of a local database while selectively backing up and syncing their data to the cloud when they are ready.

## 2. The Solution (What are we building?)

We are introducing an opt-in, cross-device synchronization feature powered by Turso Cloud. Users will be able to create a standard email/password account. Once authenticated, Dictos will connect to a personal, isolated cloud database. 

Instead of unpredictable background syncing that might block the UI or drain network resources, users will have full control via an explicit "Sync" action. This allows them to work completely offline for days or weeks, and then safely merge their local additions into the cloud—and pull down changes from their other devices—with a single command. 

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Registration & Setup**
  Given a user wants to enable sync, When they register via the TUI with an email and password, Then the server creates their account, provisions a dedicated cloud database for them, and returns a secure token. The TUI saves this token locally and connects to the cloud.

- **Scenario: Offline Local-First Work**
  Given a user is entirely offline (or hasn't synced yet), When they create new Folders or Entries, Then the UI updates instantly and the data is safely persisted to their local database without any network latency or errors.

- **Scenario: Explicit Synchronization**
  Given a user has made offline changes, When they invoke the "Sync Now" command, Then the app connects to their Turso cloud database, pushes their local changes up, pulls any new changes from their other devices down, and updates the local UI.

- **Scenario: Multi-Device Setup (First Login on Device B)**
  Given a user has synced data from Device A, When they log into the app on a fresh installation on Device B, Then they click "Sync", and their entire dictionary is pulled down from the cloud and populates their local TUI.

## 4. Feature Boundaries (What is OUT of scope?)

- [x] **Automatic Background Sync**: We are NOT building automatic background sync loops or websocket listeners in this iteration. Sync is strictly initiated by user action.
- [x] **Complex Auth Flows**: We are NOT building OAuth, password reset emails, or 2FA. Auth is strictly simple email/password (with cleanup of existing code).
- [x] **Conflict Resolution UI**: We are NOT building a UI for users to manually resolve merge conflicts. We will rely on Turso's native "last push wins" row-level resolution.
- [x] **Legacy Data Migration**: We are NOT writing a Drizzle data-migration script to convert old integer IDs to UUIDs. We will drop the existing draft databases and start fresh.

## 5. Success Criteria (How do we know we are done?)

- [x] A user can register/log in and the server successfully provisions a unique Turso database for them via the Platform API.
- [x] A user can create data while offline, and the application does not block or throw network errors.
- [x] A user can explicitly push their local data to the cloud, and verify it exists in their Turso remote database.
- [x] A user can pull data created on a different device without experiencing primary key collisions (ensured by UUID adoption).
- [x] Existing server auth code is cleaned up and strictly handles email/password and Turso token provisioning.

## 6. Assumptions

- We are migrating all Drizzle schema Primary Keys to `text` (UUIDs) generated locally via Drizzle's `$defaultFn(() => crypto.randomUUID())` to prevent multi-device ID collisions.
- The TUI client will use the `@tursodatabase/sync` package from the very beginning (even when unauthenticated) to ensure the Write-Ahead Log (WAL) sync invariants are maintained properly.
- Drizzle ORM will interface with the sync SDK using the `drizzle-orm/sqlite-proxy` driver.