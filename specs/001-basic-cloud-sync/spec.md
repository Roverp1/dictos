# Feature Specification: Basic Cloud Sync

**Feature Branch**: `002-basic-cloud-sync`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "read the srs and i want to implement only cloud features (basic ones first - like registration, auth, sync of the personal dbs and basic sync to the centralized server..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Registration and Authentication (Priority: P1)

As a user, I want to create an account and log in securely so that I can link my local data to a cloud identity and access it across multiple devices.

**Why this priority**: Required foundation for all other cloud connectivity and data synchronization features.

**Independent Test**: Can be tested by successfully creating a new account, logging out, and logging back in without any synchronization features enabled.

**Acceptance Scenarios**:

1. **Given** an unauthenticated state, **When** the user provides valid registration details, **Then** a new account is created and the user is logged in automatically.
2. **Given** an existing account, **When** the user provides valid login credentials, **Then** the user is authenticated and their session is maintained.
3. **Given** an authenticated user, **When** the user logs out, **Then** their session is terminated.

---

### User Story 2 - Background Data Synchronization (Priority: P1)

As an active user, I want my local changes to automatically synchronize with the central server in the background so that my data is continuously backed up without manual effort.

**Why this priority**: Core value of the cloud update; ensures data safety and cross-device availability.

**Independent Test**: Can be tested by making a local data change (e.g., adding a capture) while online and verifying that the data appears on the central server shortly after.

**Acceptance Scenarios**:

1. **Given** an authenticated user with network connectivity, **When** they make a local change (create, edit, or delete a capture), **Then** the change is queued and automatically transmitted to the central server.
2. **Given** a successfully synced change, **When** the user accesses their account on a secondary device, **Then** the synced change is pulled down and applied locally.

---

### User Story 3 - Offline Resilience and Recovery (Priority: P1)

As an on-the-go user, I want to continue using the application and making edits while completely offline, knowing my changes will sync later, so that my workflow is never interrupted by bad connectivity.

**Why this priority**: Maintains the core "Local-First" principle of the application.

**Independent Test**: Can be tested by disconnecting from the network, making changes, reconnecting, and verifying that all queued offline changes are successfully pushed to the server.

**Acceptance Scenarios**:

1. **Given** an authenticated user without network access, **When** they launch the application, **Then** they can access their local profile and data without interruption.
2. **Given** pending offline changes, **When** network connectivity is restored, **Then** the system automatically resumes syncing the queued modifications to the central server.

---

### User Story 4 - Data Conflict Resolution (Priority: P2)

As a multi-device user, I want the system to handle situations where I edit the same record on different devices while offline, so that I don't lose data or experience corruption.

**Why this priority**: Essential for a robust sync experience across multiple devices.

**Independent Test**: Can be tested by making conflicting edits to the same capture on two isolated instances, connecting them, and ensuring the system deterministically keeps the newest edit.

**Acceptance Scenarios**:

1. **Given** the same record modified on two offline devices, **When** both devices sync to the server, **Then** the system retains the modification with the most recent timestamp (Last Write Wins).

---

### User Story 5 - Live Social Data Access (Priority: P3)

As a user, I want to view live community or friend statistics directly from the server so that I can see up-to-date social information without cluttering my local personal database.

**Why this priority**: Separates distinct types of data (personal vs. social) and lays groundwork for future social features.

**Independent Test**: Can be tested by requesting social data and verifying that the returned information does not persist permanently in the local data store.

**Acceptance Scenarios**:

1. **Given** an active network connection, **When** the user views social statistics, **Then** the system fetches this data directly from the central server without saving it to the local offline database.

### Edge Cases

- What happens if the user's authentication session expires while they are offline? (The system should allow continued offline use but prompt for re-authentication before syncing resumes upon reconnecting).
- How are deleted records synchronized so they don't reappear when syncing with an older device? (The system must track deletions to propagate them properly across clients).
- If the central server rejects a synchronized batch of changes due to a validation error, the client MUST drop the rejected items from the queue and log an error locally, allowing subsequent items to sync.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide user registration and authentication capabilities.
- **FR-002**: System MUST maintain an authenticated session on the local device (storing the JWT in plain text locally for initial release).
- **FR-003**: System MUST permit the user to access their profile and local data while offline.
- **FR-004**: System MUST track all local data modifications (creations, updates, and deletions) across all directories and captures in a reliable queue for synchronization (no local-only scoping).
- **FR-005**: System MUST automatically synchronize queued local modifications to the central server in batches when network connectivity is available.
- **FR-006**: System MUST automatically apply remote changes from the central server to the local database via periodic background polling.
- **FR-007**: System MUST resolve data conflicts across devices using a "Last Write Wins" timestamp-based strategy.
- **FR-008**: System MUST reliably track and synchronize record deletions across all linked devices.
- **FR-009**: System MUST retrieve live social data directly from the central server without persisting it into the user's primary local data store.

### Key Entities

- **User Profile**: The user's account information and identity.
- **Session/Token**: A secure credential proving the user's authenticated state.
- **Sync Queue/Outbox**: An ordered log of pending local changes awaiting transmission to the server.
- **Tombstone**: A record indicating that a specific entity was deleted, used to propagate deletions across devices.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Account registration and subsequent login take less than 5 seconds under normal network conditions.
- **SC-002**: Local changes are pushed to the central server within 3 seconds of modification when the device is online.
- **SC-003**: The application launches and is fully usable for reading and writing data within 1 second while completely disconnected from the internet.
- **SC-004**: Conflicting sync operations resolve deterministically 100% of the time without requiring manual user intervention or causing application crashes.

## Assumptions

- **Architecture Boundary**: The core domain logic is agnostic of the specific syncing mechanism or transport layer (Hexagonal Architecture).
- **Data Sovereignty**: The local database remains the absolute source of truth for the user's personal data.
- **Scope**: Complex social features (friend requests, detailed leaderboards) are deferred to a later release; current focus is on foundational infrastructure.
are deferred to a later release; current focus is on foundational infrastructure.
itecture).
- **Data Sovereignty**: The local database remains the absolute source of truth for the user's personal data.
- **Scope**: Complex social features (friend requests, detailed leaderboards) are deferred to a later release; current focus is on foundational infrastructure.
are deferred to a later release; current focus is on foundational infrastructure.
rsonal data.
- **Scope**: Complex social features (friend requests, detailed leaderboards) are deferred to a later release; current focus is on foundational infrastructure.
are deferred to a later release; current focus is on foundational infrastructure.
itecture).
- **Data Sovereignty**: The local database remains the absolute source of truth for the user's personal data.
- **Scope**: Complex social features (friend requests, detailed leaderboards) are deferred to a later release; current focus is on foundational infrastructure.
are deferred to a later release; current focus is on foundational infrastructure.
