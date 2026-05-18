import { t } from "elysia";

export const authModel = {
  register: t.Object({
    username: t.String({
      minLength: 3,
      error: "Username must be at least 3 characters long",
    }),
    email: t.String({
      format: "email",
      error: "Must be a valid email address",
    }),
    password: t.String({
      minLength: 8,
      error: "Password must be at least 8 characters long",
    }),
  }),

  login: t.Object({
    email: t.String({ format: "email", error: "Email is required" }),
    password: t.String({ error: "Password is required" }),
  }),
};
