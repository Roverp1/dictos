# Vendor OpenTUI Toast as a TUI Package

We decided to vendor the OpenTUI toast implementation as an internal `@dictos/tui-toast` package instead of depending directly on upstream or embedding the code inside `apps/tui`. The package is terminal-specific, small enough to own, and needs Dictos-owned fixes for Notification descriptions and errors-as-values promise handling while keeping `@dictos/react` platform-agnostic.
