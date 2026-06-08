# Use React Router as a Library

To ensure consistency in routing paradigms across our TUI, Web, and future Mobile clients, we decided to use Vite with React Router as a standard library rather than adopting its framework/SSR mode. Since our local-first architecture (via Turso WASM OPFS) provides instantaneous data access, the framework's data-loading abstractions offer no performance benefits and would unnecessarily complicate mounting our Hexagonal headless UI controllers.
