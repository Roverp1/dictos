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
    }),
    email: t.String({
      format: "email",
      default: "user@exapmle.com",
    }),
    password: t.String({
      minLength: 8,
    }),
  }),

  login: t.Object({
    email: t.String({
      format: "email",
      default: "user@exapmle.com",
    }),
    password: t.String(),
  }),

  turso: t.Object({
    url: t.String(),
    token: t.String(),
  }),

  sessionResponse: t.Object({
    data: t.Object({
      user: userSchema,
      token: t.String(),
      turso: t.Object({
        url: t.String(),
        token: t.String(),
      }),
    }),
  }),

  error: t.Object({
    message: t.String(),
  }),
};
