# Technical Plan: Shared React Logic Package (@dictos/react)

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

We are adopting a **Layered/Clean Architecture** approach by introducing the `Interface Adapters` layer in `packages/react`. This package will bridge the gap between pure business logic (`@dictos/core`) and the UI (`apps/`).

### Core Concepts:
- **Headless Hooks**: Logic will be exposed via hooks that manage state and effects but do not render any UI.
- **Inversion of Control**: The package will define a `DictosProvider` that acts as a dependency injection container. The host application must provide concrete implementations of the services defined in `@dictos/core`.
- **Router Agnosticism**: We will use `react-router` (core) to define routing logic. The host application provides the specific Router implementation (e.g., `MemoryRouter` for TUI, `BrowserRouter` for Web).
- **Zustand for Internal State**: We will migrate the current `useDictionaryStore` logic to this package to manage complex tree-navigation state.

### Dependency Rule:
- `@dictos/react` **MAY** depend on `@dictos/core`.
- `@dictos/react` **MUST NOT** depend on `@dictos/adapters` or any specific `apps/`.
- `react`, `react-router`, and `zustand` will be `peerDependencies`.

## 2. Data Model & State Changes

We will migrate and formalize the "Dictionary State" currently living in the TUI.

### Dictionary State (Zustand)
- **`pathStack`** (`Folder[]`): The navigation breadcrumbs.
- **`items`** (`TreeItem[]`): The unified list of folders and entries for the current view.
- **`focus`** (`{ id: string, action: 'idle' | 'rename' | 'create' | 'delete' }`): UI interaction state.
- **`loading`** (`boolean`): Service operation status.

## 3. Interface Contracts & Boundaries

### `DictosProvider` (React Context)
- **Input:** `services: { entryService, folderService, descriptionService, syncService, authService }`
- **Behavior:** Makes these services available to all internal hooks via `useServices()`.

### `useDictionary` (Main Hook)
- **Output:**
  - `folders`: `Folder[]`
  - `entries`: `Entry[]`
  - `treeItems`: `TreeItem[]` (Unified list)
  - `state`:
    - `currentFolder`: `Folder`
    - `focus`: `{ action: 'idle' | 'createInput' | 'renameInput' | 'deleteConfirm', pane: 'tree' | 'description' }`
    - `isLoading`: `boolean`
  - `actions`:
    - `navigation`: `{ navigateIn, navigateOut }`
    - `tree`:
      - `requestCreate()`: Sets focus to `createInput`.
      - `submitCreate(val: string)`: Creates folder (if ends with `/`) or entry.
      - `requestRename()`: Sets focus to `renameInput`.
      - `submitRename(newVal: string)`: Renames selected item.
      - `requestDelete()`: Sets focus to `deleteConfirm`.
      - `confirmDelete()`: Deletes selected item.
    - `description`:
      - `requestCreate()`: Sets focus to `createDescriptionInput`.
      - `submitCreate(text: string)`: Creates description for selected entry.
    - `general`: `{ cancelAction }`: Resets focus to `idle`.

### `DictionaryRoutes` (Routing Component)
- **Output:** A React component that renders the Dictionary routing tree.
- **Routes:**
  - `/dictionary`: Main browser view.
  - `/dictionary/:folderId`: Specific folder view.
  - `/dictionary/entry/:entryId`: Entry detail view.

## 4. Migration Plan (TUI App)

1. **Phase 1**: Initialize `@dictos/react` package with `package.json` and basic `DictosProvider`.
2. **Phase 2**: Move `useServicesStore` and `useServices` hook to `@dictos/react`.
3. **Phase 3**: Move `useDictionaryStore` and associated logic hooks (`rename.ts`, `create.ts`, etc.) to `@dictos/react`.
4. **Phase 4**: Update `apps/tui` to import from `@dictos/react` and remove redundant local logic.
