import { z } from "zod";
import * as errore from "@dictos/errore";
import { definitions, loadChains } from "./definitions";

const generation = z.strictObject({
  default_model: definitions.defaultModel.schema.optional(),
});
const logging = z.strictObject({
  level: definitions.logLevel.schema.optional(),
});
export const globalConfigurationSchema = z.strictObject({
  generation: generation.optional(),
  logging: logging.optional(),
});
export const cliConfigurationSchema = z.strictObject({
  overrides: globalConfigurationSchema.optional(),
});
export const overlayConfigurationSchema = z.strictObject({
  overrides: z.strictObject({ generation: generation.optional() }).optional(),
  ocr: z
    .strictObject({ languages: definitions.ocrLanguages.schema.optional() })
    .optional(),
});
export const configurationSchemas = {
  global: globalConfigurationSchema,
  cli: cliConfigurationSchema,
  overlay: overlayConfigurationSchema,
};
export type GlobalConfigurationDocument = z.infer<
  typeof globalConfigurationSchema
>;
export type CliConfigurationDocument = z.infer<typeof cliConfigurationSchema>;
export type OverlayConfigurationDocument = z.infer<
  typeof overlayConfigurationSchema
>;
export type LogLevel = z.infer<typeof definitions.logLevel.schema>;
export type ConfigurationClient = keyof typeof loadChains;
export type ConfigurationScope = (typeof loadChains.overlay)[number];
export type SettingId = keyof typeof definitions;
export type ConfigurationLiteral =
  | string
  | number
  | boolean
  | null
  | readonly ConfigurationLiteral[]
  | { readonly [key: string]: ConfigurationLiteral };
export type ConfigurationSettingDescription = {
  id: SettingId;
  keyPath: readonly string[];
  description: string;
  defaultValue: ConfigurationLiteral;
  example: ConfigurationLiteral;
};
export type ConfigurationDocument = { source: string; value: unknown };
export type ResolveConfigurationInput = {
  client: ConfigurationClient;
  documents: Readonly<
    Partial<Record<ConfigurationScope, ConfigurationDocument>>
  >;
  environment: { ocrLanguages: readonly string[] | null };
};
export type ConfigurationIssue = {
  kind: "initialize" | "read" | "parse" | "validate" | "snapshot";
  source: string;
  keyPath: readonly string[];
  line: number | null;
  column: number | null;
  message: string;
};
export class ConfigurationError extends errore.createTaggedError({
  name: "ConfigurationError",
  message: "Configuration is invalid",
}) {
  readonly issues: readonly ConfigurationIssue[];
  constructor(input: {
    issues: readonly ConfigurationIssue[];
    cause?: unknown;
  }) {
    super({ cause: input.cause });
    this.issues = input.issues.length
      ? input.issues
      : [
          {
            kind: "validate",
            source: "configuration",
            keyPath: [],
            line: null,
            column: null,
            message: "Invalid configuration.",
          },
        ];
  }
}
export const valueOriginSchema = z
  .strictObject({
    kind: z.enum(["default", "global", "cli", "overlay", "environment"]),
    source: z.string().nullable(),
    keyPath: z.array(z.string()).readonly(),
  })
  .readonly();
export const configurationSnapshotSchema = z
  .strictObject({
    version: z.literal(1),
    client: z.enum(["cli", "overlay"]),
    settings: z
      .strictObject({
        defaultModel: definitions.defaultModel.schema.nullable(),
        logLevel: definitions.logLevel.schema,
        ocrLanguages: definitions.ocrLanguages.schema.readonly().nullable(),
      })
      .readonly(),
    origins: z
      .strictObject({
        defaultModel: valueOriginSchema,
        logLevel: valueOriginSchema,
        ocrLanguages: valueOriginSchema.optional(),
      })
      .readonly(),
  })
  .superRefine((snapshot, context) => {
    const issue = (path: string[]) =>
      context.addIssue({
        code: "custom",
        path,
        message: "Inconsistent snapshot value or origin.",
      });
    if (
      snapshot.client === "cli" &&
      (snapshot.settings.ocrLanguages !== null ||
        snapshot.origins.ocrLanguages !== undefined)
    )
      issue(["settings", "ocrLanguages"]);
    if (
      snapshot.client === "overlay" &&
      (snapshot.settings.ocrLanguages === null ||
        snapshot.origins.ocrLanguages === undefined)
    )
      issue(["settings", "ocrLanguages"]);
    for (const id of Object.keys(definitions) as SettingId[]) {
      const origin = snapshot.origins[id];
      if (!origin) continue;
      if (origin.kind === "default") {
        if (
          origin.source !== null ||
          origin.keyPath.length ||
          JSON.stringify(snapshot.settings[id]) !==
            JSON.stringify(definitions[id].defaultValue)
        )
          issue(["origins", id]);
        continue;
      }
      if (origin.kind === "environment") {
        if (
          snapshot.client !== "overlay" ||
          id !== "ocrLanguages" ||
          origin.source !== "DICTOS_OCR_LANG" ||
          origin.keyPath.length
        )
          issue(["origins", id]);
        continue;
      }
      const paths: Partial<Record<ConfigurationScope, readonly string[]>> =
        definitions[id].paths;
      const path = paths[origin.kind];
      const scopes: readonly ConfigurationScope[] = loadChains[snapshot.client];
      if (
        !scopes.includes(origin.kind) ||
        !path ||
        JSON.stringify(path) !== JSON.stringify(origin.keyPath) ||
        !origin.source?.trim() ||
        snapshot.settings[id] === null
      )
        issue(["origins", id]);
    }
  })
  .readonly();
export type ValueOrigin = z.infer<typeof valueOriginSchema>;
export type ConfigurationSnapshot = z.infer<typeof configurationSnapshotSchema>;

function safeDiagnosticLabel(value: string): string {
  return value.replace(
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u{${character.codePointAt(0)!.toString(16)}}`
  );
}

export function validationError(input: {
  kind: "validate" | "snapshot";
  source: string;
  issues: readonly z.core.$ZodIssue[];
}) {
  return new ConfigurationError({
    issues: input.issues.flatMap((issue) => {
      const paths =
        issue.code === "unrecognized_keys"
          ? issue.keys.map((key) => [...issue.path, key])
          : [issue.path];
      return paths.map((path) => ({
        kind: input.kind,
        source: safeDiagnosticLabel(input.source),
        keyPath: path.map((part) => safeDiagnosticLabel(String(part))),
        line: null,
        column: null,
        message:
          issue.code === "unrecognized_keys"
            ? "Unknown or prohibited configuration key."
            : input.kind === "snapshot" && issue.path[0] === "version"
              ? "Expected snapshot transport version 1."
              : input.kind === "snapshot" && issue.path[0] === "client"
                ? "Expected the cli or overlay configuration client."
                : issue.path.at(-1) === "level" ||
                    issue.path.at(-1) === "logLevel"
                  ? "Expected trace, debug, info, warn, error, or fatal."
                  : issue.path.at(-1) === "default_model" ||
                      issue.path.at(-1) === "defaultModel"
                    ? "Expected a qualified provider/model ID without whitespace."
                    : issue.code === "invalid_type"
                      ? `Expected ${issue.expected}.`
                      : issue.code === "too_small"
                        ? "Expected a nonempty language list."
                        : issue.code === "invalid_format"
                          ? "Expected a language identifier without whitespace, plus signs, or empty path segments."
                          : issue.code === "custom"
                            ? "Inconsistent snapshot value or origin."
                            : "Invalid setting value or shape.",
      }));
    }),
  });
}
