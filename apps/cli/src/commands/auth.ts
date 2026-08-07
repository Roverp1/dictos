import type { Command } from "commander";

import { InputValidationError, type User } from "@dictos/core";

import { CliExitCode, type CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
} from "../app/command-action";

export const registerAuthCommands = (program: Command, context: CliContext) => {
  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("register")
    .description("Register a Dictos account")
    .requiredOption("--username <username>", "username")
    .requiredOption("--email <email>", "email address")
    .action(async (options: { username: string; email: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const password = await context.passwordPrompt.readPassword(
        "Type your password for creation:"
      );
      if (password instanceof Error) {
        return handleExpectedError(context, password);
      }

      const passConfirmation = await context.passwordPrompt.readPassword(
        "Type confirmation for your password:"
      );
      if (passConfirmation instanceof Error)
        return handleExpectedError(context, passConfirmation);

      if (password !== passConfirmation) {
        context.output.writeError("Passwords do not match");
        process.exitCode = CliExitCode.UsageError;
        return;
      }

      const userRes = await dependencies.authService.register({
        email: options.email,
        username: options.username,
        password: password,
      });

      if (userRes instanceof InputValidationError) {
        context.output.writeError(`${userRes.message}`);
        userRes.fields.forEach((field) =>
          context.output.writeError(`${field.path} -> ${field.message}`)
        );
        process.exitCode = CliExitCode.UsageError;
        return;
      }

      if (userRes instanceof Error) {
        return handleExpectedError(context, userRes);
      }

      // how annoying is it to clear the screen for this?
      context.output.writeData(`\x1bcRegistration is finished a successfully`);
      context.output.writeData(
        `We welcome you user \x1b[3m${userRes.id}\x1b[23m`
      );
    });

  auth
    .command("login")
    .description("Log in to a Dictos account")
    .requiredOption("--email <email>", "email address")
    .action(async (options: { email: string }) => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const password = await context.passwordPrompt.readPassword("Password:");
      if (password instanceof Error) {
        return handleExpectedError(context, password);
      }

      const result = await dependencies.authService.login({
        email: options.email,
        password: password,
      });

      if (result instanceof InputValidationError) {
        context.output.writeError(`${result.message}`);
        result.fields.forEach((field) =>
          context.output.writeError(`${field.path} -> ${field.message}`)
        );
        process.exitCode = CliExitCode.UsageError;
        return;
      }

      if (result instanceof Error) {
        return handleExpectedError(context, result);
      }

      context.output.writeData(`\x1bcLoggination is finished a successfully`);
      context.output.writeData(
        `We welcome you user \x1b[3m${result.id}\x1b[23m`
      );
    });

  auth
    .command("logout")
    .description("Log out of the current Dictos account")
    .action(async () => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const prevUser = await dependencies.authService.getCurrentUser();
      if (prevUser instanceof Error) {
        return handleExpectedError(context, prevUser);
      }

      if (prevUser === null) {
        context.output.writeData(`You're not logged in, dummy`);
        // not needed?
        process.exitCode = CliExitCode.Success;
        return;
      }

      const clearSesRes = await dependencies.authService.logout();
      if (clearSesRes instanceof Error)
        return handleExpectedError(context, clearSesRes);

      context.output.writeData(`User ${prevUser.username} just logged out 󰇸 `);
    });

  auth
    .command("status")
    .description("Show authentication status")
    .action(async () => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      const currUser = await dependencies.authService.getCurrentUser();
      if (currUser instanceof Error)
        return handleExpectedError(context, currUser);

      if (currUser === null) {
        context.output.writeData(`Not logged in. All data is saved locally`);
        return;
      }

      context.output.writeData(
        `We are welcoming you back Mr. ${currUser.username}\n`
      );
      Object.keys(currUser).forEach((key) =>
        context.output.writeData(`${key}: ${currUser[key as keyof User]}`)
      );
    });
};
