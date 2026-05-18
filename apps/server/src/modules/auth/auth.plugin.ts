import { Elysia, status } from "elysia";
import jwt from "@elysia/jwt";
import * as errore from "errore";

import {
  AuthService,
  InvalidCredentialsError,
  UserExistsErorr,
} from "./auth.service";
import { authModel } from "./auth.model";

export const authPlugin = (authService: AuthService) => {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: process.env.JWT_SECRET || "dev-secret-key",
      })
    )
    .post(
      "/auth/register",
      async ({ body, jwt }) => {
        const user = await authService.register(
          body.username,
          body.email,
          body.password
        );

        if (user instanceof Error) {
          let code = user instanceof UserExistsErorr ? 409 : 500;
          console.error("Error during user registration:", user);
          return status(code, { message: user.message });
        }

        const token = await jwt.sign({ sub: user.id.toString() });
        return status(201, { data: { user, token } });
      },
      {
        body: authModel.register,
      }
    )
    .post(
      "/auth/login",
      async ({ body, jwt }) => {
        const user = await authService.login(body.email, body.password);

        if (user instanceof Error) {
          let code = user instanceof InvalidCredentialsError ? 401 : 500;
          console.error("Error during user registration:", user);
          return status(code, { message: user.message });
        }

        const token = await jwt.sign({ sub: user.id.toString() });
        return status(200, { data: { user, token } });
      },
      {
        body: authModel.login,
      }
    );
};
