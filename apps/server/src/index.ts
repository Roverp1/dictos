import { Elysia, status } from "elysia";
import cors from "@elysia/cors";
import openapi from "@elysia/openapi";

import { AuthService } from "./modules/auth/auth.service";
import { createCentralDatabase } from "./db/db";
import { authPlugin } from "./modules/auth/auth.plugin";

const bootstrap = async () => {
  const db = await createCentralDatabase();

  const authService = new AuthService(db);

  const app = new Elysia()
    .use(cors())
    .use(openapi())
    .get("/", () => {
      return status(200, { message: "Hello" });
    })
    .use(authPlugin(authService))
    .listen(process.env.PORT || 1488);

  console.log(
    `🦊 Dictos Central Server is running at ${app.server?.hostname}:${app.server?.port}`
  );

  return app;
};

bootstrap().catch(console.error);

export type App = Awaited<ReturnType<typeof bootstrap>>;
