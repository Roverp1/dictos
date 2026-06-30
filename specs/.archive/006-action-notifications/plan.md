# Technical Plan: Action Notifications

**Parent Spec**: [spec.md](./spec.md) | **Status**: Draft

## 1. Architectural Strategy

Action Notifications will be implemented as a platform-agnostic presentation boundary in `@dictos/react`. The shared React package will define a `Notifier` interface and receive an implementation through `DictosProvider`, next to the existing services and `Logger`. This follows the current dependency injection pattern while keeping the headless package free of OpenTUI, Sonner, DOM, and app-specific imports.

Dictionary action hooks will keep the existing errors-as-values flow. They will call a service, check `instanceof Error`, log the failure, show an error Notification through `notifier.error`, and return early. This keeps expected failures explicit and avoids throwing just to drive UI feedback. The Notifier should be a required provider dependency; a no-op default would silently hide missing wiring and recreate the failure mode this feature is fixing.

Each client will adapt the shared Notifier contract to its own renderer. The TUI client will use a vendored `@dictos/tui-toast` package based on OpenTUI toast, following ADR 0005. The web client will keep Sonner and expose a thin adapter. Promise-backed Notifications will be implemented at the Notifier adapter/helper boundary so operations returning `Error | T` work without throw-wrappers.

## 2. Data Model & State Changes

### Database

No database schema changes are required.

### Core Domain

No core domain entity or service changes are required. Domain services should continue returning `Error | T` unions for expected failures.

### Shared React Dependencies

`DictosDependencies` in `packages/react` will gain one required dependency:

- **`notifier`** (`Notifier`): Platform-provided Notification adapter used by shared React action hooks.

### TUI Toast Package

A new workspace package will vendor the terminal toast implementation:

- **Package path**: `packages/tui-toast`
- **Package name**: `@dictos/tui-toast`
- **Purpose**: Provide terminal-specific toast state, renderables, React binding, and types for `apps/tui`.

The package should stay close to the upstream OpenTUI toast source. Local changes should be limited to required Dictos fixes, especially title plus description rendering and errors-as-values promise behavior.

## 3. Interface Contracts & Boundaries

### `Notifier` (Code Interface)

```typescript
export interface NotificationOptions {
  description?: string;
}

export interface NotificationContent {
  message: string;
  description?: string;
}

export type NotificationMessage<T = unknown> =
  | string
  | NotificationContent
  | ((
      value: T,
    ) => string | NotificationContent | Promise<string | NotificationContent>);

export interface NotificationPromiseMessages<T> {
  loading: string | NotificationContent;
  success: NotificationMessage<T>;
  error: NotificationMessage<Error>;
}

export interface Notifier {
  success(message: string, options?: NotificationOptions): void;

  error(message: string, options?: NotificationOptions): void;

  promise<T>(
    operation: Promise<T | Error> | (() => Promise<T | Error>),
    messages: NotificationPromiseMessages<T>,
  ): Promise<T | Error>;
}
```

The `promise` method must treat a resolved `Error` as a failed operation. It should show the error Notification and return the same `Error` value to the caller. It should not require callers to throw expected failures.

### `DictosDependencies` (Code Interface)

```typescript
interface DictosDependencies {
  entryService: EntryService;
  folderService: FolderService;
  descriptionService: DescriptionService;
  authService: AuthService;
  syncService: SyncService;
  logger: Logger;
  notifier: Notifier;
}
```

Both `apps/tui` and `apps/web` must provide `notifier` at their `DictosProvider` composition roots.

### Dictionary Action Hooks (Boundary Behavior)

Dictionary action hooks should notify on handled service failures that currently only log and return. The expected pattern is:

```typescript
const res = await entryService.createEntry({ text, folderId });
if (res instanceof Error) {
  logger.error("Failed to create entry.", res);
  notifier.error("Failed to create Entry", { description: res.message });
  return;
}
```

The first implementation scope includes failures in:

- `useTreeActions.submitCreate`
- `useTreeActions.submitRename`
- `useTreeActions.confirmDelete`
- `useDescriptionActions.submitCreate`
- `useDescriptionActions.submitRename`
- `useDescriptionActions.confirmDelete`

Developer-state failures such as missing active Entry, missing selected target, or impossible action state should remain logged. They do not need user Notifications unless the failure represents something the user can act on.

### TUI Notifier Adapter (Code Interface)

```typescript
import type { Notifier } from "@dictos/react";
import { toast } from "@dictos/tui-toast/react";

export const tuiNotifier: Notifier = {
  success(message, options) {
    toast.success(message, options);
  },

  error(message, options) {
    toast.error(message, options);
  },

  async promise(operation, messages) {
    // Calls the vendored toast promise helper or wraps it so resolved Error values
    // render as failures and return the original Error value.
  },
};
```

The TUI app layout should import `Toaster` from `@dictos/tui-toast/react` after vendoring replaces `@opentui-ui/toast`.

### Web Notifier Adapter (Code Interface)

```typescript
import type { Notifier } from "@dictos/react";
import { toast } from "sonner";

export const webNotifier: Notifier = {
  success(message, options) {
    toast.success(message, options);
  },

  error(message, options) {
    toast.error(message, options);
  },

  async promise(operation, messages) {
    // Wraps Sonner's promise behavior so resolved Error values render as failures
    // and return the original Error value.
  },
};
```

The web app layout should continue rendering Sonner's `Toaster`.

### Package Boundary

`apps/tui/package.json` should replace the external toast dependency with the internal package:

```json
{
  "dependencies": {
    "@dictos/tui-toast": "workspace:*"
  }
}
```

`@dictos/react` must not depend on `@dictos/tui-toast`, `sonner`, `@opentui/core`, `@opentui/react`, or any app package.
