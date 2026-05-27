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

  async register(
    credentials: RegisterCredentials
  ): Promise<AuthSession | InputValidationError | RegistrationError> {
    try {
      const { data, error, status } =
        await this.client.auth.register.post(credentials);

      if (error) {
        switch (error.status) {
          case 422:
            const fields = error.value.errors.map((e) => ({
              path: e.pointer.replace(/^#\//, ""),
              message: e.reason,
            }));

            return new InputValidationError({ fields });

          default:
            return new RegistrationError({
              reason: error.value.detail,
            });
        }
      }

      if (!data || "status" in data)
        return new RegistrationError({
          reason: "No data returned from the server",
        });

      return data.data;
    } catch (err) {
      return new RegistrationError({ reason: "Network failure", cause: err });
    }
  }

  async login(
    credentials: AuthCredentials
  ): Promise<AuthSession | InputValidationError | AuthError> {
    try {
      const { data, error } = await this.client.auth.login.post(credentials);

      if (error) {
        switch (error.status) {
          case 422:
            const fields = error.value.errors.map((e) => ({
              path: e.pointer.replace(/^#\//, ""),
              message: e.reason,
            }));
            return new InputValidationError({ fields });

          default:
            return new AuthError({
              reason: error.value.detail,
            });
        }
      }

      if (!data) return new AuthError({ reason: "No data returned" });

      return data.data;
    } catch (err) {
      return new AuthError({ reason: "Network failure", cause: err });
    }
  }
}
