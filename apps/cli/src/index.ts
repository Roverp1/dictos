import { Command } from "commander";

import { registerAuthCommands } from "./commands/auth";
import { registerDescriptionCommands } from "./commands/description";
import { registerEntryCommands } from "./commands/entry";
import { registerFolderCommands } from "./commands/folder";
import { registerSyncCommands } from "./commands/sync";
import { createCliContext } from "./app/context";
import { CliExitCode } from "./app/types";

const program = new Command();
const context = createCliContext();

program
  .name("dictos")
  .description("Command-line interface for Dictos")
  .version("0.0.0")
  .showHelpAfterError();

registerAuthCommands(program, context);
registerFolderCommands(program, context);
registerEntryCommands(program, context);
registerDescriptionCommands(program, context);
registerSyncCommands(program, context);

await program.parseAsync().catch((err) => {
  process.exitCode = CliExitCode.UnexpectedFailure;
  context.output.writeError(err instanceof Error ? err.message : String(err));
});
