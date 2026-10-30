import {
  createCliDependencies,
  createProviderDependencies,
} from "./dependencies";
import { createCliOutput } from "./output";
import { createTerminalPrompt } from "./terminal-prompt";
import { loadCliConfiguration } from "./configuration";
import type {
  CliContext,
  CliDependencyResult,
  ConfigurationLoader,
} from "./types";

export const createCliContext = ({
  loadConfiguration = loadCliConfiguration,
}: { loadConfiguration?: ConfigurationLoader } = {}): CliContext => {
  let configuration: ReturnType<ConfigurationLoader> | null = null;
  const getConfiguration: ConfigurationLoader = () =>
    (configuration ??= loadConfiguration());
  let providerDependencies: ReturnType<
    typeof createProviderDependencies
  > | null = null;
  let dependencies: Promise<CliDependencyResult> | null = null;

  const getProviderGraph = () => {
    providerDependencies ??= getConfiguration().then((configuration) => {
      if (configuration instanceof Error) return configuration;
      return createProviderDependencies({ configuration });
    });
    return providerDependencies;
  };

  return {
    output: createCliOutput(),
    terminalPrompt: createTerminalPrompt(),
    getConfiguration,

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
