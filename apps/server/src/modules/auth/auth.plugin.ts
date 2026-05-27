import { Elysia, status } from "elysia";
import jwt from "@elysia/jwt";
import * as errore from "errore";

import { errorsPlugin, type ErrorResponse } from "plugins/errors.plugin";

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
    .use(errorsPlugin)
    .post(
      "/auth/register",
      async ({ body, jwt, request }) => {
        const user = await authService.register(
          body.username,
          body.email,
          body.password
        );

        if (user instanceof UserExistsErorr) {
          return status(409, {
            type: "about:blank",
            status: 409,
            title: "Conflict",
            detail: user.message,
            instance: new URL(request.url).pathname,
          } as ErrorResponse);
        }

        if (user instanceof Error) {
          console.error("Registration failed:", user);
          return status(500, {
            type: "about:blank",
            status: 500,
            title: "Internal Error",
            detail: "Could not register user",
            instance: new URL(request.url).pathname,
          } as ErrorResponse);
        }

        const token = await jwt.sign({ sub: user.id.toString() });
        return status(201, { data: { user, token } });
      },
      {
        body: authModel.register,
        response: {
          201: authModel.sessionResponse,
          409: "errors.standard",
          422: "errors.validation",
          500: "errors.standard",
        },
      }
    )
    .post(
      "/auth/login",
      async ({ body, jwt, request }) => {
        const user = await authService.login(body.email, body.password);

        if (user instanceof InvalidCredentialsError) {
          console.error("Error during user login:", user);
          return status(401, {
            type: "about:blank",
            status: 401,
            title: "Invalid Credentials",
            detail: "Invalid email or password",
            instance: new URL(request.url).pathname,
          } as ErrorResponse);
        }

        if (user instanceof Error) {
          console.error("Login failed:", user);
          return status(500, {
            type: "about:blank",
            status: 500,
            title: "Internal Error",
            detail: "Could not login a user",
            instance: new URL(request.url).pathname,
          } as ErrorResponse);
        }

        const token = await jwt.sign({ sub: user.id.toString() });
        return status(200, { data: { user, token } });
      },
      {
        body: authModel.login,
        response: {
          200: authModel.sessionResponse,
          401: "errors.standard",
          422: "errors.validation",
          500: "errors.standard",
        },
      }
    );
};
