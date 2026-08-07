# First-Class Command Client

We decided to add a Dictos CLI as a first-class Command Client alongside the TUI, Web, and future Mobile clients, rather than treating it as a temporary developer tool. The CLI should support the same user-facing capabilities as other clients, including server-dependent features like auth, Sync, and Mirroring, while composing the same domain services and infrastructure adapters through the application root.

The CLI is script-first and non-interactive by default because the TUI already owns rich terminal interaction. Commands should prefer explicit flags, stable output, predictable exit codes, and automation-friendly behavior over prompts, menus, or fuzzy guided flows.

## Consequences

- CLI behavior becomes part of the supported Dictos product surface, so command names, output modes, and exit codes need care before release.
- Interactive terminal workflows belong in the TUI unless a CLI prompt is required for security or unavoidable external integration.
- Auth still needs a dedicated decision because browser-based OAuth, device-code login, and token-based login have different UX, security, and scripting trade-offs.
