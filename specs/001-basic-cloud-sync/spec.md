# Feature Specification: Basic Cloud Sync

**Feature Branch**: `001-basic-cloud-sync`  
**Status**: In Progress  

## User Scenarios & Testing

### User Story 1 - Account Registration and Authentication
As a user, I want to create an account and log in securely so that I can link my local data to a cloud identity and access it across multiple devices.
- **Success Criteria**: Local `users` and `session` tables are populated correctly; JWT is stored locally.

### User Story 2 - Background Data Synchronization
As an active user, I want my local changes to automatically synchronize with my personal remote database in the background using Turso's native replication.

### User Story 3 - Shared Activity Sync
As a user, I want my daily capture statistics to be pushed to the central server via a REST API using the Outbox pattern.

## Requirements

- **FR-001**: User registration and authentication via ElysiaJS backend.
- **FR-002**: Local-first identity: `users` table stores profile data for offline access.
- **FR-003**: Token management via a singleton `session` table.
- **FR-004**: Type-safe client-server communication using Eden Treaty.
- **FR-005**: Native libSQL synchronization for all personal entities.
- **FR-006**: Outbox-based REST synchronization for shared activity aggregates.

## Success Criteria

- **SC-001**: Eden Treaty provides full type safety for backend calls in the TUI client.
- **SC-002**: Identity is preserved locally even when the session is cleared or offline.
- **SC-003**: Domain errors from services are correctly mapped to HTTP status codes.
