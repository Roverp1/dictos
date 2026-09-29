import {
  createCliDependencies,
  createProviderDependencies,
} from "./dependencies";
import { createCliOutput } from "./output";
import { createTerminalPrompt } from "./terminal-prompt";
import type { CliContext, CliDependencyResult } from "./types";

export const createCliContext = (): CliContext => {
  let providerDependencies: ReturnType<
    typeof createProviderDependencies
  > | null = null;
  let dependencies: Promise<CliDependencyResult> | null = null;

  const getProviderGraph = () => {
    providerDependencies ??= createProviderDependencies();
    return providerDependencies;
  };

  return {
    output: createCliOutput(),
    terminalPrompt: createTerminalPrompt(),

    async getProviderDependencies() {
      const provider = await getProviderGraph();
      if (provider instanceof Error) return provider;
      return provider.dependencies;
    },

    async getDependencies() {
      if (dependencies !== null) return dependencies;

      dependencies = getProviderGraph().then((provider) => {
        if (provider instanceof Error) return provider;
        return createCliDependencies(provider);
      });
      return dependencies;
    },
  };
};
