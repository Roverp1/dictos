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

        if (user instanceof UserExistsErorr) {
          console.error("Error during user registration:", user);
          return status(409, { message: user.message });
        }

        if (user instanceof Error) {
          console.error("Error during user registration:", user);
          return status(500, { message: user.message });
        }

        const token = await jwt.sign({ sub: user.id.toString() });
        return status(201, { user, token });
      },
      {
        body: authModel.register,
      }
    )
    .post(
      "/auth/login",
      async ({ body, jwt }) => {
        const user = await authService.login(body.email, body.password);

        if (user instanceof InvalidCredentialsError) {
          console.error("Error during user login:", user);
          return status(401, { message: user.message });
        }

        if (user instanceof Error) {
          console.error("Error during user login:", user);
          return status(500, { message: user.message });
        }

        const token = await jwt.sign({ sub: user.id.toString() });
        return status(200, { user, token });
      },
      {
        body: authModel.login,
        response: {
          200: authModel.session,
          401: authModel.error,
          500: authModel.error,
        },
      }
    );
};
