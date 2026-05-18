# Implementation Plan: Basic Cloud Sync

**Branch**: `001-basic-cloud-sync` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary
Implement a dual-sync architecture using libSQL (Turso). Personal data (captures, definitions) syncs natively via Turso SDK. Shared activity data syncs to a central database using an additive Outbox pattern via a Central REST API, designed to support future deletion-aware entity sync.

## Project Structure & File Responsibilities

### Core Domain (`packages/core/`)
- `models/User.ts`: Defines user profile and session interfaces.
- `ports/outbound/AuthPort.ts`: Interface for registration and login.
- `ports/outbound/SyncPort.ts`: Interface for native sync and outbox processing.
- `services/AuthService.ts`: Login and token management logic.
- `services/SyncService.ts`: Coordinates dual-sync: native sync + additive outbox push.

### Adapters (`packages/adapters/`)
- `db/schema/schema.ts`: Defines local tables (including `outbox`) and central tables.
- `db/schema/triggers/activity_triggers.sql`: SQL triggers for `AFTER INSERT` on `captures` to update local aggregates and outbox.
- `db/libsql-adapter/LibSqlSyncRepository.ts`: Implements `SyncPort` using `@libsql/client` and Drizzle.
- `http/CentralApiAdapter.ts`: Implements `AuthPort` and handles outbox REST pushes.

### Central Backend (`apps/backend/`)
- `src/routes/auth.ts`: Handles JWT issuance and central records.
- `src/routes/sync.ts`: REST endpoint for outbox pushes.

### Terminal UI (`apps/tui/`)
- `src/app/sync-daemon.ts`: Periodic loop calling `SyncService.sync()`.

## Constitution Check
- [x] **Local Sovereignty**: All writes happen to the local embedded replica first.
- [x] **Hexagonal Architecture**: Core domain isolated from libSQL and REST details.
