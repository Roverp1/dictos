import type {
  AuthCredentials,
  RegisterCredentials,
  User,
} from "../models/user";
import type { UserRepository } from "../ports/outbound";
import type { AuthPort } from "../ports/outbound/auth-port";
import type { SessionRepository } from "../ports/outbound/session-repository";
import type {
  AuthError,
  StorageError,
  InputValidationError,
  RegistrationError,
} from "../errors";
import type { SyncService } from "./sync-service";

export class AuthService {
  constructor(
    private authPort: AuthPort,
    private sessionRepo: SessionRepository,
    private userRepo: UserRepository,
    private syncService: SyncService
  ) {}

  async register(
    credentials: RegisterCredentials
  ): Promise<User | RegistrationError | InputValidationError | StorageError> {
    const result = await this.authPort.register(credentials);
    if (result instanceof Error) return result;

    const { user, session } = result;

    const userRes = await this.userRepo.save(user);
    if (userRes instanceof Error) return userRes;

    const sessionRes = await this.sessionRepo.saveSession(session);
    if (sessionRes instanceof Error) return sessionRes;

    // this is shit
    // registration method should only handle registration
    if (session.turso) {
      await this.syncService.connect(session.turso.url, session.turso.token);
      await this.syncService.sync();
    }

    return user;
  }

  async login(
    credentials: AuthCredentials
  ): Promise<User | AuthError | InputValidationError | StorageError> {
    const result = await this.authPort.login(credentials);
    if (result instanceof Error) return result;

    const { session, user } = result;

    const userRes = await this.userRepo.save(user);
    if (userRes instanceof Error) return userRes;

    const sessionRes = await this.sessionRepo.saveSession(session);
    if (sessionRes instanceof Error) return sessionRes;

    // this is also shit
    if (session.turso) {
      await this.syncService.connect(session.turso.url, session.turso.token);
      await this.syncService.sync();
    }

    return user;
  }

  async logout(): Promise<void | StorageError> {
    return await this.sessionRepo.clearSession();
  }

  async getCurrentUser(): Promise<User | StorageError | null> {
    const session = await this.sessionRepo.getSession();
    if (session instanceof Error) return session;
    if (session === null) return null;

    const userId = session.userId;
    const userRes = await this.userRepo.findById(userId);
    if (userRes instanceof Error) return userRes;
    if (!userRes) return null;

    return userRes;
  }
}
