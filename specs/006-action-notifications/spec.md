# Specification: Action Notifications

**Status**: Draft | **Created**: Jun 24, 2026

## 1. The Problem (Why are we doing this?)

Dictos already handles many expected failures without crashing. Dictionary actions such as creating, renaming, and deleting Entries, Folders, and Descriptions call services that return errors as values. The current shared React action hooks usually log those failures and return early. That protects the application from hard crashes, but it leaves the user with no visible feedback when an action does not complete.

This is especially painful because these failures happen inside UI command handlers. A user may press Enter to create an Entry, confirm deletion, or rename a Folder, and nothing visibly changes. The caller often cannot recover in a meaningful way, but the user still needs to know the action failed and, when available, why it failed.

Dictos also has two different client surfaces today. The terminal client uses OpenTUI toast behavior and the web client uses Sonner. The shared React package cannot import either without breaking the headless boundary. The feature needs a common Notification intent that each platform can render natively.

## 2. The Solution (What are we building?)

Dictos will introduce a shared `Notifier` dependency for user-visible Notifications. Shared React actions will use this dependency to show handled action failures to the user after logging them. Each client will provide its own implementation, so the terminal app can render terminal toasts while the web app can render browser toasts.

The first Notifier API will cover the current needs: success Notifications, error Notifications, and promise-backed Notifications. Promise-backed Notifications must fit Dictos' errors-as-values style. If an operation resolves to an `Error`, the Notification must show the error state and return the `Error` value instead of forcing callers to throw.

The terminal toast implementation will be vendored into Dictos as a separate internal TUI package. This keeps the terminal-specific rendering code out of `@dictos/react` and out of the app's feature folders, while allowing Dictos to fix small behavior gaps such as multi-line descriptions. Local changes to the vendored package should stay minimal.

## 3. User Experience (How does it work?)

### Core Workflows

- **Scenario: Dictionary action fails**
  Given the user is managing the Dictionary, when creating, renaming, or deleting an Entry, Folder, or Description fails, then the app shows a visible error Notification instead of only logging the failure.

- **Scenario: Validation details are available**
  Given a failed action includes useful validation details, when the failure is shown to the user, then the Notification can include a short title and a secondary description so the user can understand what needs to be fixed.

- **Scenario: Action succeeds through a promise-backed Notification**
  Given the user starts an operation with loading feedback, when the operation completes successfully, then the Notification changes to a success state and the caller receives the successful value.

- **Scenario: Action returns an Error value**
  Given the user starts an operation that follows the errors-as-values pattern, when the operation resolves to an `Error`, then the Notification changes to an error state and the caller receives the same `Error` value without writing a throw-wrapper.

- **Scenario: Platform-native rendering**
  Given the same shared action fails on different clients, when the TUI client handles the Notification, then it renders through the TUI toast implementation; when the web client handles the Notification, then it renders through Sonner.

## 4. Feature Boundaries (What is OUT of scope?)

- [ ] We are NOT importing OpenTUI toast, Sonner, or any other platform-specific renderer into `@dictos/react`.
- [ ] We are NOT designing a full cross-platform visual Notification system in this iteration.
- [ ] We are NOT replacing Sonner in the web client.
- [ ] We are NOT heavily rewriting the vendored OpenTUI toast package beyond the fixes needed for Dictos integration.
- [ ] We are NOT changing core domain services to throw exceptions for expected failures.
- [ ] We are NOT requiring every success path in the Dictionary to show a success Notification by default.

## 5. Success Criteria (How do we know we are done?)

- [ ] `@dictos/react` exposes a documented approach for user-visible handled failures through a platform-provided Notifier.
- [ ] Dictionary create, rename, and delete failures that are currently only logged can show error Notifications to the user.
- [ ] The shared React package remains platform-agnostic and does not depend on OpenTUI toast, Sonner, or app-specific code.
- [ ] The TUI client provides a Notifier implementation backed by the internal vendored TUI toast package.
- [ ] The web client provides a Notifier implementation backed by Sonner.
- [ ] Promise-backed Notifications treat resolved `Error` values as failures and return the same `Error` value to the caller.
- [ ] Error Notifications can show a secondary description for details such as validation messages.
- [ ] The terminal toast implementation can render a Notification with both a title and a description.

## 6. Assumptions

- [ ] `Notification` is the canonical product term; `toast`, `snackbar`, and similar words describe platform-specific renderings.
- [ ] `Notifier` is the shared interface name for the injected dependency used by `@dictos/react`.
- [ ] The initial Notifier methods are `success`, `error`, and `promise`.
- [ ] OpenTUI toast is vendored as `@dictos/tui-toast`, following ADR 0005.
- [ ] The vendored TUI toast package should stay close to upstream.
