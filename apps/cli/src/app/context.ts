import { createCliDependencies } from "./dependencies";
import { createCliOutput } from "./output";
import { createTerminalPrompt } from "./terminal-prompt";
import type { CliContext, CliDependencyResult } from "./types";

export const createCliContext = (): CliContext => {
  let dependencies: CliDependencyResult | null = null;

  return {
    output: createCliOutput(),
    terminalPrompt: createTerminalPrompt(),

    async getDependencies() {
      if (dependencies !== null) return dependencies;

      dependencies = await createCliDependencies();
      return dependencies;
    },
  };
};
