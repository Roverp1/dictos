import {
  AuthError,
  RegistrationError,
  type AuthCredentials,
  type AuthPort,
  type AuthSession,
  type RegisterCredentials,
} from "@dictos/core";
import { treaty } from "@elysia/eden";
import { type App } from "@dictos/server";

export class CentralApiAdapter implements AuthPort {
  private client: ReturnType<typeof treaty<App>>;

  constructor(private baseUrl: string) {
    this.client = treaty<App>(baseUrl);
  }

  async login(credentials: AuthCredentials): Promise<AuthSession | AuthError> {
    const { data, error } = await this.client.auth.login.post(credentials);

    if (error) {
      return new AuthError({
        reason: error.value?.message || "Login failed",
        cause: error,
      });
    }

    return data;
  }

  async register(
    credentials: RegisterCredentials
  ): Promise<AuthSession | RegistrationError> {
    const { data, error } = await this.client.auth.register.post(credentials);

    if (error) {
      return new RegistrationError({
        reason: error.value?.message || "Registration failed",
        cause: error,
      });
    }

    return data;
  }
}
