# WASM Turso Sync Instructions

Read this package's `README.md` before changing dependencies or verification tooling.

- Do not add a package-local test runner, Vitest, Playwright, browser binaries, or related Nix dependencies.
- Do not bind the shared core or db-core contracts inside this package.
- Keep the package `typecheck`-only unless the testing strategy is explicitly redesigned.
- The Web client is broken and unmaintained; there are no active Web/browser E2E tests. Root test/typecheck scripts exclude browser workspaces. Do not claim those commands verify WASM behavior.
- Defer WASM migration, OPFS, and Bun/WASM compatibility coverage to a real cross-platform browser E2E strategy when Web support resumes.

These package rules override generic shared-contract guidance. Stop and ask if a task appears to require violating them.
