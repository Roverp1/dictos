import type {
  AuthCredentials,
  AuthResult,
  RegisterCredentials,
} from "../../models/user";
import type {
  AuthError,
  InputValidationError,
  RegistrationError,
} from "../../errors";

export interface AuthPort {
  login(
    credentials: AuthCredentials
  ): Promise<AuthResult | AuthError | InputValidationError>;
  register(
    credentials: RegisterCredentials
  ): Promise<AuthResult | RegistrationError | InputValidationError>;
}
