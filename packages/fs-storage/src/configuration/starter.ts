import { describeConfiguration, type ConfigurationScope } from "@dictos/config";
import * as errore from "@dictos/errore";
import * as toml from "smol-toml";
import { configurationFailure } from "./errors";

const inheritance: Record<ConfigurationScope, string> = {
  global: "Shared settings. Omitted settings use built-in defaults.",
  cli: "Inherits config.toml. Enable permitted overrides below to replace shared settings.",
  overlay:
    "Inherits config.toml and cli.toml. Enable permitted overrides or Overlay settings below.",
};

export function renderStarter(input: {
  scope: ConfigurationScope;
  schemaUri: string;
  source: string;
}) {
  const sections = [
    `#:schema ${input.schemaUri}`,
    "",
    `# ${inheritance[input.scope]}`,
    "# Uncomment a table and its settings to enable them.",
    "",
  ];
  for (const setting of describeConfiguration({ scope: input.scope })) {
    const value =
      setting.defaultValue === null ? setting.example : setting.defaultValue;
    const key = setting.keyPath.at(-1)!;
    const assignment = errore.try(
      () =>
        toml
          .stringify({ [key]: value } as Parameters<typeof toml.stringify>[0])
          .trimEnd(),
      (cause) =>
        configurationFailure({
          kind: "initialize",
          source: input.source,
          message: "Could not render the configuration starter.",
          cause,
        })
    );
    if (assignment instanceof Error) return assignment;
    const table = setting.keyPath
      .slice(0, -1)
      .map((part) =>
        /^[A-Za-z0-9_-]+$/.test(part) ? part : JSON.stringify(part)
      )
      .join(".");
    sections.push(
      ...setting.description.split("\n").map((line) => `# ${line}`)
    );
    sections.push(
      `# Default: ${setting.defaultValue === null ? "not configured" : JSON.stringify(setting.defaultValue)}`
    );
    if (table) sections.push(`# [${table}]`);
    sections.push(...assignment.split("\n").map((line) => `# ${line}`), "");
  }
  return sections.join("\n");
}
