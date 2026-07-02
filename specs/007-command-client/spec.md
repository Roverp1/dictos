# Specification: Command Client

**Status**: Draft | **Created**: Jul 02, 2026

## 1. The Problem (Why are we doing this?)

Dictos currently depends on graphical or interactive clients for users to exercise product features. That makes feature work heavier than it needs to be: every new capability has to fight through UI layout, navigation, input design, and visual polish before the underlying behavior can be used end-to-end.

This slows down product development and makes it harder to separate feature logic from presentation work. Dictos already has a local-first, keyboard-driven shape, and its domain services are meant to be shared across clients. A command-line interface gives the project a direct way to execute the same user actions without designing a full screen for each one first.

The CLI also creates a future automation surface. Power users should eventually be able to script Dictionary operations, auth, and Sync without driving the TUI by hand.

## 2. The Solution (What are we building?)

Build a first-class Dictos Command Client. It is a supported interface alongside the TUI, Web, and future Mobile clients, not a temporary developer-only tool.

The Command Client exposes the main existing Dictos actions through shell commands. It shares the same local Dictos data and session as the TUI on the same machine, so actions taken from one client are visible to the other. In v1, the CLI is script-oriented and non-interactive by default, with one security exception: password input is prompted during auth login/register instead of being passed as a command argument.

The CLI should be implemented with Commander.js for argument parsing. Commands should use stable resource groups and consistent verbs so the interface can grow without becoming a pile of one-off commands.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Register from the CLI**
  Given a user has no active Dictos session, when they run `dictos auth register --username <username> --email <email>`, then the CLI prompts for a password, creates the account through the existing server auth flow, saves the local session, and connects Sync when server credentials are returned.

- **Scenario: Log in from the CLI**
  Given a user has an existing Dictos account, when they run `dictos auth login --email <email>`, then the CLI prompts for a password, authenticates through the existing server auth flow, saves the local session, and connects Sync when server credentials are returned.

- **Scenario: Check auth state**
  Given the user may or may not have an active session, when they run `dictos auth status`, then the CLI prints whether Dictos is authenticated and, when available, identifies the current user.

- **Scenario: Log out from the CLI**
  Given the user has an active local session, when they run `dictos auth logout`, then the CLI clears the local session. This does not delete Dictionary data and does not require `--yes`.

- **Scenario: Create Dictionary content**
  Given the user knows the target IDs, when they run commands like `dictos folder create`, `dictos entry create --folder <folder-id> --text <text>`, or `dictos description create --entry <entry-id> --text <text>`, then the CLI creates the requested object and prints the created ID.

- **Scenario: List Dictionary content**
  Given the user wants to inspect local Dictionary data, when they run `dictos folder list`, `dictos entry list`, or `dictos description list`, then the CLI prints human-readable information for the requested data.

- **Scenario: Update Dictionary content**
  Given the user knows the ID of an existing object, when they run an update command such as `dictos entry update <entry-id> --text <text>`, then the CLI updates the object. On success, it prints nothing.

- **Scenario: Delete Dictionary content**
  Given the user wants to delete a Folder, Entry, or Description, when they run the delete command without `--yes`, then the CLI refuses the action with a clear message. When they repeat the command with `--yes`, the CLI performs the deletion. On success, it prints nothing.

- **Scenario: Run Sync**
  Given the user is authenticated and has Sync credentials, when they run `dictos sync run`, then the CLI performs the normal Sync operation as one user-facing action: pushing local changes and pulling remote changes.

- **Scenario: Shared local data**
  Given the TUI and CLI are used on the same machine, when the user creates or changes Dictionary data through the CLI, then the same data is available to the TUI because both clients use the same local database and session.

- **Scenario: Database already open**
  Given another Dictos client already has the shared local database open, when the user runs a CLI command that needs the database, then the command fails fast with a clear database-in-use error. The CLI must not silently create a separate database and must not wait or retry in v1.

### Command Groups

V1 includes these command groups only:

- `dictos auth ...`
- `dictos folder ...`
- `dictos entry ...`
- `dictos description ...`
- `dictos sync ...`

CRUD-capable groups use consistent verbs:

- `create`
- `update`
- `delete`
- `list`

Sync has one v1 command:

- `dictos sync run`

### Reference Style

IDs are the primary way to reference existing objects in v1. Human-readable paths, URLs, or name-based lookup can be added later, but they are not part of the initial scope.

Examples:

```bash
dictos entry update <entry-id> --text "bonfire"
dictos description create --entry <entry-id> --text "a large outdoor fire"
```

### Output Rules

The CLI follows quiet-success behavior:

- Commands print nothing on success unless output is the command's purpose.
- `create` commands print the created ID.
- `list` and `auth status` print human-readable output by default.
- Failures print clear errors.

Future `--json` support should remain possible, but v1 does not implement JSON output.

### Text Input

V1 uses `--text` for Entry and Description text input. Stdin input is deferred, but command shapes should not block adding a future `--stdin` flag.

Examples:

```bash
dictos entry create --folder <folder-id> --text "bonfire"
dictos description update <description-id> --text "an outdoor fire"
```

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] No JSON output implementation in v1.
- [ ] No stdin text input in v1.
- [ ] No `show` command in v1.
- [ ] No `--verbose` flag in v1.
- [ ] No human-readable path, URL, or name-based object references in v1.
- [ ] No browser OAuth, device-code login, password command argument, or password environment variable in v1.
- [ ] No `sync status`, `sync push`, or `sync pull` commands in v1.
- [ ] No local broker or daemon for concurrent TUI and CLI database access in v1.
- [ ] No separate CLI-only database or CLI-only session.

## 5. Success Criteria (How do we know we are done?)

- [ ] A user can register, log in, check auth status, and log out through the CLI using the existing email/password account flow.
- [ ] A user can create, update, delete, and list Folders through the CLI.
- [ ] A user can create, update, delete, and list Entries through the CLI.
- [ ] A user can create, update, delete, and list Descriptions through the CLI.
- [ ] A user can run Sync through `dictos sync run` as a single push-and-pull operation.
- [ ] CLI and TUI use the same local database and session on the same machine.
- [ ] CLI commands that need the database fail fast with a clear error when the shared database is already open by another Dictos client.
- [ ] Destructive commands for Folder, Entry, and Description deletion require `--yes`.
- [ ] Create commands print the created ID, while successful update/delete commands are quiet.
- [ ] Passwords are entered through a terminal prompt and are not accepted as command flags in v1.

## 6. Assumptions

- [ ] The CLI is implemented as a new Dictos app under the monorepo.
- [ ] The CLI composes existing Dictos services and adapters instead of introducing a separate application layer.
- [ ] Commander.js is used for CLI argument parsing.
- [ ] The CLI uses the existing auth server endpoints and session shape.
- [ ] Existing errors-as-values conventions still apply at service and adapter boundaries.
- [ ] The first implementation prioritizes feature coverage over polished CLI ergonomics.
