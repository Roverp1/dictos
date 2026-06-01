export interface User {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface AuthSession {
  userId: string;
  token: string;
  turso?: {
    url: string;
    token: string;
  };
}

export interface AuthResult {
  user: User;
  session: AuthSession;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  username: string;
}
