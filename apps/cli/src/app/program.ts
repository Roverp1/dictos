import { Command } from "commander";
import { registerAuthCommands } from "../commands/auth";
import { registerDescriptionCommands } from "../commands/description";
import { registerEntryCommands } from "../commands/entry";
import { registerFolderCommands } from "../commands/folder";
import { registerInstructionCommands } from "../commands/instruction";
import { registerProviderCommands } from "../commands/provider";
import { registerSenseCommands } from "../commands/sense";
import { registerSyncCommands } from "../commands/sync";
import type { CliContext } from "./types";

export const createCliProgram = (context: CliContext): Command => {
  const program = new Command()
    .name("dictos")
    .description("Command-line interface for Dictos")
    .version("0.0.0")
    .showHelpAfterError();
  registerAuthCommands(program, context);
  registerFolderCommands(program, context);
  registerEntryCommands(program, context);
  registerDescriptionCommands(program, context);
  registerSenseCommands(program, context);
  registerInstructionCommands(program, context);
  registerProviderCommands(program, context);
  registerSyncCommands(program, context);
  return program;
};
