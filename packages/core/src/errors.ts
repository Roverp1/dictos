import * as errore from "errore";

export class ValidationError extends errore.createTaggedError({
  name: "ValidationError",
  message: "Invalid data: $reason",
}) {}

export class NotFoundError extends errore.createTaggedError({
  name: "NotFoundError",
  message: "$entity with id $id not found",
}) {}

/** @deprecated use {@link StorageError} instead */
export class DbError extends errore.createTaggedError({
  name: "DbError",
  message: "Database operation $operation failed. Reason: $reason",
}) {}

export class StorageError extends errore.createTaggedError({
  name: "StorageError",
  message: "Storage operation $operation failed. Reason: $reason",
}) {}

export class LlmError extends errore.createTaggedError({
  name: "LlmError",
  message: "Llm operation $operation failed",
}) {}

export class AuthError extends errore.createTaggedError({
  name: "AuthError",
  message: "Authentication failed: $reason",
}) {}

export class RegistrationError extends errore.createTaggedError({
  name: "RegistrationError",
  message: "Registration failed: $reason",
}) {}

export class SyncError extends errore.createTaggedError({
  name: "SyncError",
  message: "Synchronization failed: $reason",
}) {}

export interface FieldError {
  path: string;
  message: string;
}

export class InputValidationError extends errore.createTaggedError({
  name: "InputValidationError",
  message: "Validation failed",
}) {
  fields: FieldError[];

  constructor(options: { fields: FieldError[]; cause?: unknown }) {
    super({ cause: options.cause });

    this.fields = options.fields;
  }
}

export class OfflineError extends errore.createTaggedError({
  name: "OfflineError",
  message: "Device is offline or server is unreachable.",
}) {}
