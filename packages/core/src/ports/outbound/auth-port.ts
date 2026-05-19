import type {
  AuthCredentials,
  AuthSession,
  RegisterCredentials,
} from "@models/user";
import type {
  AuthError,
  InputValidationError,
  RegistrationError,
} from "errors";

export interface AuthPort {
  login(
    credentials: AuthCredentials
  ): Promise<AuthSession | AuthError | InputValidationError>;
  register(
    credentials: RegisterCredentials
  ): Promise<AuthSession | RegistrationError | InputValidationError>;
}
