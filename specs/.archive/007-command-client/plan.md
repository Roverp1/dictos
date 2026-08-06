# Technical Plan: Command Client

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

Add `apps/cli` as a Bun application that composes the same local Dictos services and adapters used by the TUI. The CLI should not introduce a separate application layer, a separate database, or a CLI-specific session model. It should call `packages/core` services through a small CLI composition root that wires filesystem storage, Turso sync, Drizzle repositories, auth HTTP adapter, logging, and command handlers.

This mirrors the existing TUI bootstrap because the CLI is another first-class client, not a backend shortcut. Reusing `getDictosDataDir()`, `dictos.db`, `session.json`, and `local-state.json` preserves one local-first product: data created by the CLI is the same data the TUI sees. The trade-off is that embedded Turso only supports one process opening the database file at a time. V1 accepts that limitation and maps open failures into a clear database-in-use CLI error instead of waiting, retrying, or silently creating a second database.

Commander.js should own argument parsing and help generation. Command actions should stay thin: parse CLI input, call composed services, format success output, and map returned errors to process exit codes. Domain validation remains in `packages/core`; persistence remains in repository adapters; server communication remains behind `AuthPort`; Sync remains behind `SyncService`.

## 2. Data Model & State Changes

### Database Schema

No database schema changes are required. The CLI uses the existing local `dictos.db` database under the shared Dictos data directory.

### Filesystem State

- **`dictos.db`** (`Turso database file`): Existing shared local database used by Dictos clients on the same machine.
- **`session.json`** (`AuthSession JSON`): Existing shared local session file managed by `FsSessionRepository`.
- **`local-state.json`** (`LocalState JSON`): Existing shared local device state managed by `FsLocalStateRepository`; used by `SqliteEntryRepository` for Activity identity.
- **`dictos.log` / `dictos-cli.log`** (`log files`): The CLI and TUI should use separate log files, and CLI user-facing command output must not be mixed with logs on stdout.

### CLI Runtime State

- **Parsed command** (`Commander.js command context`): Ephemeral process-local state produced from argv.
- **Password prompt result** (`string`): Ephemeral value read from terminal input for auth login/register. It must not be accepted through flags or environment variables in v1.

## 3. Interface Contracts & Boundaries

### `apps/cli` Composition Root

```typescript
type CliDependencies = {
  authService: AuthService;
  folderService: FolderService;
  entryService: EntryService;
  descriptionService: DescriptionService;
  syncService: SyncService;
  logger: Logger;
};

async function createCliDependencies(): Promise<CliDependencies | Error>;
```

`createCliDependencies()` resolves `getDictosDataDir()`, opens `path.join(dataDir, "dictos.db")` through `BunTursoClient.create()`, loads `local-state.json`, creates SQLite repositories, creates `FsSessionRepository`, creates `CentralApiAdapter`, creates `HttpConnectivityAdapter`, and returns core services. If opening the database fails because another Dictos process owns the file, it returns an error that command execution maps to a clear database-in-use message.

### `PasswordPrompt` (CLI Boundary)

```typescript
interface PasswordPrompt {
  readPassword(label: string): Promise<string | Error>;
}
```

The CLI auth commands use this boundary to read passwords without accepting password flags. The implementation should hide typed input when the terminal supports it and return an error if password input cannot be read.

### `CliOutput` (CLI Boundary)

```typescript
interface CliOutput {
  writeData(text: string): void;
  writeError(text: string): void;
}
```

`writeData()` writes command result data to stdout. `writeError()` writes failures to stderr. Logs must remain separate from command output.

### `CliExitCode` (CLI Boundary)

```typescript
type CliExitCode = 0 | 1 | 2 | 3 | 4;
```

- `0`: Success.
- `1`: Unexpected command failure.
- `2`: Invalid command usage or missing required CLI input.
- `3`: Expected domain, validation, auth, sync, or storage failure.
- `4`: Shared database is already open by another Dictos process.

### `FolderService` (Core Service Additions)

```typescript
class FolderService {
  getFolderById(id: string): Promise<Folder | DbError | null>;
  getRootFolder(): Promise<Folder | DbError>;
  getSubFolders(parentId: string): Promise<Folder[] | DbError>;
  createFolder(data: NewFolder): Promise<Folder | DbError | ValidationError>;
  renameFolder(
    id: string,
    newName: string
  ): Promise<Folder | DbError | ValidationError>;
  deleteFolder(id: string): Promise<Folder | DbError>;
}
```

`getFolderById()` should be added so CLI command handlers do not reach into `FolderRepository` directly when validating parent IDs or future command behavior. V1 `folder update` maps to `renameFolder()` only.

### Existing Core Services Used by CLI

```typescript
class EntryService {
  createEntry(data: NewEntry): Promise<Entry | DbError | ValidationError>;
  getEntryById(id: string): Promise<Entry | DbError | null>;
  getEntriesInFolder(folderId: string): Promise<Entry[] | DbError>;
  updateEntry(id: string, data: Partial<NewEntry>): Promise<Entry | DbError>;
  deleteEntry(id: string): Promise<Entry | DbError>;
}

class DescriptionService {
  createDescription(
    data: NewDescription
  ): Promise<Description | DbError | ValidationError>;
  getDescriptionsForEntry(entryId: string): Promise<Description[] | DbError>;
  updateDescription(
    id: string,
    data: Partial<NewDescription>
  ): Promise<Description | DbError>;
  deleteDescription(id: string): Promise<Description | DbError>;
}

class AuthService {
  register(
    credentials: RegisterCredentials
  ): Promise<User | RegistrationError | InputValidationError | StorageError>;
  login(
    credentials: AuthCredentials
  ): Promise<User | AuthError | InputValidationError | StorageError>;
  logout(): Promise<void | StorageError>;
  getCurrentUser(): Promise<User | StorageError | null>;
}

class SyncService {
  sync(): Promise<SyncResult | SyncError | OfflineError>;
}
```

No new auth endpoints are required. The CLI uses `CentralApiAdapter`, which already implements `AuthPort` against the existing server auth endpoints.

### Auth Commands

```text
dictos auth register --username <username> --email <email>
dictos auth login --email <email>
dictos auth logout
dictos auth status
```

- `register` prompts for password, calls `AuthService.register()`, and is quiet on success.
- `login` prompts for password, calls `AuthService.login()`, and is quiet on success.
- `logout` calls `AuthService.logout()` and does not require `--yes`.
- `status` calls `AuthService.getCurrentUser()` and prints human-readable auth state.

### Folder Commands

```text
dictos folder create --name <name> [--parent <folder-id>]
dictos folder update <folder-id> --name <name>
dictos folder delete <folder-id> --yes
dictos folder list [--parent <folder-id>]
```

- `create` defaults to the root Folder when `--parent` is omitted, then prints the created Folder ID.
- `update` renames the Folder in v1.
- `delete` requires `--yes` and calls `FolderService.deleteFolder()`.
- `list` defaults to root subfolders. With `--parent`, it lists subfolders under that Folder.

### Entry Commands

```text
dictos entry create --folder <folder-id> --text <text>
dictos entry update <entry-id> --text <text>
dictos entry delete <entry-id> --yes
dictos entry list --folder <folder-id>
```

- `create` calls `EntryService.createEntry()` and prints the created Entry ID.
- `update` changes Entry text in v1.
- `delete` requires `--yes` and calls `EntryService.deleteEntry()`.
- `list` requires `--folder` and calls `EntryService.getEntriesInFolder()`.

### Description Commands

```text
dictos description create --entry <entry-id> --text <text>
dictos description update <description-id> --text <text>
dictos description delete <description-id> --yes
dictos description list --entry <entry-id>
```

- `create` calls `DescriptionService.createDescription()` and prints the created Description ID.
- `update` changes Description text in v1.
- `delete` requires `--yes` and calls `DescriptionService.deleteDescription()`.
- `list` requires `--entry` and calls `DescriptionService.getDescriptionsForEntry()`.

### Sync Command

```text
dictos sync run
```

`sync run` loads the shared session, reconnects `SyncService` with stored Turso credentials when available, then calls `SyncService.sync()`. It performs push and pull as one user-facing action. It is quiet on success.

### Output Contract

```text
create success: <created-id>
update success: no output
delete success: no output
sync success: no output
list success: human-readable rows
auth status success: human-readable status
failure: error: <message>
```

`--json` is intentionally not implemented in v1, but list and status formatting should be isolated enough that future JSON output can be added without touching service calls.

### Error Mapping

Expected `Error` values returned by services are converted into clear CLI messages and non-zero exit codes. Command handlers must not throw for expected failures. Programmer mistakes and unrecoverable startup failures may still crash through the process boundary after being logged.

The database-in-use case should be detected at dependency creation time when `BunTursoClient.create()` fails to open the shared DB file. The CLI maps it to exit code `4` with a message such as `error: Dictos database is already open by another process`.
