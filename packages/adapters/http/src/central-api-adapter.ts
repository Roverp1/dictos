import {
  AuthError,
  RegistrationError,
  type AuthCredentials,
  type AuthPort,
  type AuthSession,
  type RegisterCredentials,
} from "@dictos/core";
import { API_ROUTES } from "../../../core/src/config/api-routes";

export class CentralApiAdapter implements AuthPort {
  constructor(private baseUrl: string) {}

  async login(credentials: AuthCredentials): Promise<AuthSession | AuthError> {
    const url = `${this.baseUrl}${API_ROUTES.AUTH.LOGIN}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    }).catch(
      (e) =>
        new AuthError({
          reason: "Network connection failed",
          cause: e,
        })
    );

    if (response instanceof Error) return response;

    if (!response.ok) {
      // const data = await response.json().catch(() => ({}));
      return new AuthError({
        reason: `Server error: ${response.status}`,
      });
    }

    return (await response.json()) as AuthSession;
  }

  async register(
    credentials: RegisterCredentials
  ): Promise<AuthSession | RegistrationError> {
    const url = `${this.baseUrl}${API_ROUTES.AUTH.REGISTER}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    }).catch(
      (e) =>
        new RegistrationError({ reason: "Network connection failed", cause: e })
    );

    if (response instanceof Error) return response;

    if (!response.ok) {
      return new RegistrationError({
        reason: `Server error: ${response.status}`,
      });
    }

    return (await response.json()) as AuthSession;
  }
}
