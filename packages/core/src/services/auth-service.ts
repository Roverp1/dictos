import type { AuthCredentials, RegisterCredentials, User } from "@models/user";
import type { AuthPort } from "@ports/outbound/auth-port";
import type { SessionRepository } from "@ports/outbound/session-repository";
import type {
  AuthError,
  DbError,
  InputValidationError,
  RegistrationError,
} from "errors";

export class AuthService {
  constructor(
    private authPort: AuthPort,
    private sessionRepo: SessionRepository
  ) {}

  async register(
    credentials: RegisterCredentials
  ): Promise<User | RegistrationError | InputValidationError | DbError> {
    const session = await this.authPort.register(credentials);
    if (session instanceof Error) return session;

    const res = await this.sessionRepo.saveSession(session);
    if (res instanceof Error) return res;

    return session.user;
  }

  async login(
    credentials: AuthCredentials
  ): Promise<User | AuthError | DbError> {
    const session = await this.authPort.login(credentials);
    if (session instanceof Error) return session;

    const res = await this.sessionRepo.saveSession(session);
    if (res instanceof Error) return res;

    return session.user;
  }

  async logout(): Promise<void | DbError> {
    return await this.sessionRepo.clearSession();
  }

  async getCurrentUser(): Promise<User | DbError | null> {
    const session = await this.sessionRepo.getSession();
    if (session instanceof Error) return session;
    if (session === null) return null;

    return session.user;
  }
}
