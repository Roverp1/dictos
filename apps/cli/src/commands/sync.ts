import type { Command } from "commander";

import type { SyncResult } from "@dictos/core";

import { CliExitCode, type CliContext } from "../app/types";
import {
  getDependenciesOrExit,
  handleExpectedError,
} from "../app/command-action";

export const registerSyncCommands = (program: Command, context: CliContext) => {
  const sync = program.command("sync").description("Run Sync");

  sync
    .command("run")
    .description("Push local changes and pull remote changes")
    .action(async () => {
      const dependencies = await getDependenciesOrExit(context);
      if (dependencies === null) return;

      // mb it would be better to connect during dependencies creation
      // it would also allow for easier sync
      // on every invoked changing command
      // this shit just doesnt feel right
      const sessionRes = await dependencies.sessionRepo.getSession();

      const session = sessionRes instanceof Error ? null : sessionRes;
      if (session === null) {
        context.output.writeData(`You're not logged in, dummy`);
        return;
      }

      if (!session.turso) {
        context.output.writeError(
          "\x1b[3mUser\x1b[23m must first enable cloud sync"
        );
        process.exitCode = CliExitCode.UsageError;
        return;
      }

      const connectRes = await dependencies.syncService.connect(
        session.turso.url,
        session.turso.token
      );
      if (connectRes instanceof Error) {
        return handleExpectedError(context, connectRes);
      }

      const syncRes = await dependencies.syncService.sync();
      if (syncRes instanceof Error) {
        return handleExpectedError(context, syncRes);
      }

      context.output.writeData("Synchorization successful!\n");
      context.output.writeData(
        `operations synced: ${syncRes.stats.operationsSynced}`
      );
      context.output.writeData(`bytes sent: ${syncRes.stats.bytesSent}`);
      context.output.writeData(
        `bytes received: ${syncRes.stats.bytesReceived}`
      );
    });
};
