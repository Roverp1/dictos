import { t } from "elysia";

const userSchema = t.Object({
  id: t.String({ format: "uuid" }),
  username: t.String(),
  email: t.String(),
  bio: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  createdAt: t.Date(),
  lastLoginAt: t.Date(),
});

export const authModel = {
  register: t.Object({
    username: t.String({
      minLength: 3,
      error: "Username must be at least 3 characters long",
    }),
    email: t.String({
      format: "email",
      default: "user@exapmle.com",
      error: "Must be a valid email address",
    }),
    password: t.String({
      minLength: 8,
      error: "Password must be at least 8 characters long",
    }),
  }),

  login: t.Object({
    email: t.String({
      format: "email",
      default: "user@exapmle.com",
      error: "Email is required",
    }),
    password: t.String({ error: "Password is required" }),
  }),

  session: t.Object({
    user: userSchema,
    token: t.String(),
  }),

  error: t.Object({
    message: t.String(),
  }),
};
