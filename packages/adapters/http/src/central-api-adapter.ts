import {
  AuthError,
  InputValidationError,
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

  private mapEdenError<E extends { status: number; value: any }>(
    error: E,
    fallbackErrorClass: any
  ) {
    if (error.status === 422 && error.value) {
      if ("type" in error.value && error.value.type === "validation") {
        const path = error.value.property?.replace(/^\//, "") || "unknown";
        const message = error.value.message || "Invalid input";

        return new InputValidationError({
          fields: [{ path, message }],
        });
      }
    }

    return new fallbackErrorClass({
      reason: error.value?.message || "Operation failed",
      cause: error,
    });
  }

  async login(credentials: AuthCredentials): Promise<AuthSession | AuthError> {
    const { data, error } = await this.client.auth.login.post(credentials);

    if (error) return this.mapEdenError(error, AuthError);

    return data;
  }

  async register(
    credentials: RegisterCredentials
  ): Promise<AuthSession | RegistrationError> {
    const { data, error } = await this.client.auth.register.post(credentials);

    if (error) return this.mapEdenError(error, RegistrationError);

    return data;
  }
}
