export interface User {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  username: string;
}
