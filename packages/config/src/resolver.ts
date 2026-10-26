import { definitions, loadChains } from "./definitions";
import {
  ConfigurationError,
  configurationSchemas,
  validationError,
} from "./schemas";
import type {
  ConfigurationClient,
  ConfigurationScope,
  ConfigurationSettingDescription,
  ConfigurationSnapshot,
  ResolveConfigurationInput,
  SettingId,
  ValueOrigin,
} from "./schemas";
import { validateConfigurationSnapshot } from "./snapshot";

export function configurationScopes(input: {
  client: ConfigurationClient;
}): readonly ConfigurationScope[] {
  return loadChains[input.client];
}

export function describeConfiguration(input: {
  scope: ConfigurationScope;
}): readonly ConfigurationSettingDescription[] {
  return (Object.keys(definitions) as SettingId[]).flatMap((id) => {
    const definition = definitions[id];
    const paths: Partial<Record<ConfigurationScope, readonly string[]>> =
      definition.paths;
    const keyPath = paths[input.scope];
    return keyPath
      ? [
          {
            id,
            keyPath: Object.freeze([...keyPath]),
            description: definition.description,
            defaultValue: definition.defaultValue,
            example: definition.example,
          },
        ]
      : [];
  });
}

function atPath(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      current && typeof current === "object"
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value
  );
}

export function resolveConfiguration(
  input: ResolveConfigurationInput
): ConfigurationSnapshot | ConfigurationError {
  const settings: Partial<ConfigurationSnapshot["settings"]> = {};
  const origins: Partial<Record<SettingId, ValueOrigin>> = {
    defaultModel: { kind: "default", source: null, keyPath: [] },
    logLevel: { kind: "default", source: null, keyPath: [] },
    ...(input.client === "overlay"
      ? {
          ocrLanguages: { kind: "default" as const, source: null, keyPath: [] },
        }
      : {}),
  };
  for (const scope of configurationScopes(input)) {
    const document = input.documents[scope];
    if (!document) continue;
    const parsed = configurationSchemas[scope].safeParse(document.value);
    if (!parsed.success)
      return validationError({
        kind: "validate",
        source: document.source,
        issues: parsed.error.issues,
      });
    for (const description of describeConfiguration({ scope })) {
      const value = atPath(parsed.data, description.keyPath);
      if (value === undefined) continue;
      Object.assign(settings, { [description.id]: value });
      origins[description.id] = {
        kind: scope,
        source: document.source,
        keyPath: [...description.keyPath],
      };
    }
  }
  if (input.client === "overlay" && input.environment.ocrLanguages !== null) {
    const languages = definitions.ocrLanguages.schema.safeParse(
      input.environment.ocrLanguages
    );
    if (!languages.success)
      return validationError({
        kind: "validate",
        source: "DICTOS_OCR_LANG",
        issues: languages.error.issues,
      });
    Object.assign(settings, { ocrLanguages: languages.data });
    origins.ocrLanguages = {
      kind: "environment",
      source: "DICTOS_OCR_LANG",
      keyPath: [],
    };
  }
  return validateConfigurationSnapshot({
    value: {
      version: 1,
      client: input.client,
      settings: {
        defaultModel:
          settings.defaultModel ?? definitions.defaultModel.defaultValue,
        logLevel: settings.logLevel ?? definitions.logLevel.defaultValue,
        ocrLanguages:
          input.client === "overlay"
            ? (settings.ocrLanguages ?? definitions.ocrLanguages.defaultValue)
            : null,
      },
      origins,
    },
  });
}
