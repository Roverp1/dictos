# Share Local Data Across Clients

We decided that Dictos clients on the same machine, including the TUI and CLI, should use the same local database and session instead of maintaining separate per-client data stores. This keeps Dictos as one local-first product: an Entry added from the CLI should appear in the TUI, and logging in once should authorize the local clients that share the same data directory.

## Consequences

- Embedded Turso currently allows only one process to open a database file at a time, so v1 CLI commands may fail when another Dictos client already has the shared database open.
- CLI commands should fail fast with a clear database-in-use error instead of waiting, retrying, or silently creating a separate database.
- If concurrent CLI and TUI use becomes important, the likely future shape is a local broker process that owns the database connection and accepts commands from clients.
