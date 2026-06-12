---
name: logger
description: Guidelines and best practices for structured logging using the @dictos/logger interface. Invoke this skill whenever you are adding, modifying, or reviewing log statements across the project. It enforces the "Wide Event" philosophy, prevents the use of template strings in log messages, explains severity levels, and promotes the use of child loggers for context.
---

# Logger

The `@dictos/logger` package provides a structured logging interface for the Dictos application. Follow the principles of structured "Wide Event" logging.

## Rules

1.  **Never use template literals or string concatenation in the message argument.** The message string should be a static event name (a constant string). All dynamic variables must be placed in the `context` object.
    - Bad: `logger.info(\`User ${user.id} logged in\`)`
    - Good: `logger.info("User login successful", { userId: user.id })`
2.  **Every error log must include the actual error object.** This ensures the stack trace and the `errore` cause chain are preserved.
    - Bad: `logger.error("Sync failed: " + err.message)`
    - Good: `logger.error("Sync failed", err, { adapter: "WasmTursoClient" })`
3.  **Severity Meanings:**
    - `fatal`: Unrecoverable crashes (e.g., database file is corrupted).
    - `error`: An operation failed and the user or system needs to know (e.g., Sync failed).
    - `warn`: Something went wrong but the system recovered (e.g., Network timeout, retrying).
    - `info`: Major lifecycle events (e.g., Sync completed successfully).
    - `debug`: Detailed steps useful for development (e.g., Connection opened).
    - `trace`: Extreme detail (e.g., raw SQL queries).
4.  **"Wide" Events:** Instead of scattering many log lines across a single operation, emit fewer logs with a "wide" context object containing many fields (e.g., URL, byte count, durations all in one log).
