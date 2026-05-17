import { t } from "elysia";

export const authModel = {
  register: t.Object({
    username: t.String({ minLength: 3 }),
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
  }),

  login: t.Object({
    email: t.String({ format: "email" }),
    password: t.String(),
  }),
};
