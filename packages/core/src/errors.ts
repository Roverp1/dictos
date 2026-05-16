import * as errore from "errore";

export class ValidationError extends errore.createTaggedError({
  name: "ValidationError",
  message: "Invalid data: $reason",
}) {}

export class NotFoundError extends errore.createTaggedError({
  name: "NotFoundError",
  message: "$entity with id $id not found",
}) {}

export class DbError extends errore.createTaggedError({
  name: "DbError",
  message: "Database operation $operation failed. Reason: $reason",
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
