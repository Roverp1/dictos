import type {
  AuthCredentials,
  AuthSession,
  RegisterCredentials,
} from "@models/user";
import type { AuthError, RegistrationError } from "errors";

export interface AuthPort {
  login(credentials: AuthCredentials): Promise<AuthSession | AuthError>;
  register(
    credentials: RegisterCredentials
  ): Promise<AuthSession | RegistrationError>;
}
