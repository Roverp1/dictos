import { createCliDependencies } from "./dependencies";
import { createCliOutput } from "./output";
import { createPasswordPrompt } from "./password-prompt";
import type { CliContext, CliDependencyResult } from "./types";

export const createCliContext = (): CliContext => {
  let dependencies: CliDependencyResult | null = null;

  return {
    output: createCliOutput(),
    passwordPrompt: createPasswordPrompt(),

    async getDependencies() {
      if (dependencies !== null) return dependencies;

      dependencies = await createCliDependencies();
      return dependencies;
    },
  };
};
