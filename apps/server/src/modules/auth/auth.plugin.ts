import { Elysia, status } from "elysia";

import { AuthService } from "./auth.service";
import jwt from "@elysia/jwt";
import { authModel } from "./auth.model";
import { isSetAccessor } from "typescript";

export const authPlugin = (authService: AuthService) => {
  new Elysia()
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

        if (!user) {
          // need to improve error handling with authService
          return status(401, {
            message: "Registration failed or user already exists",
          });
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

        if (!user) {
          return status(401, {
            success: false,
            error: "Invalid credentials",
          });
        }
      },
      {
        body: authModel.login,
      }
    );
};
