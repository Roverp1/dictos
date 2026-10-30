import { z } from "zod";

function defineSetting<
  const T extends {
    schema: z.ZodType;
    description: string;
    defaultValue: unknown;
    example: unknown;
    paths: object;
  },
>(input: T): T {
  return {
    ...input,
    schema: input.schema.meta({
      description: input.description,
      examples: [input.example],
      ...(input.defaultValue === null ? {} : { default: input.defaultValue }),
    }),
  };
}

export const definitions = {
  defaultModel: defineSetting({
    schema: z.string().regex(/^[^\s/]+\/[^\s]+$/),
    description: "Qualified provider/model ID used to initialize new work.",
    defaultValue: null,
    example: "openai/MODEL_ID",
    paths: {
      global: ["generation", "default_model"],
      cli: ["overrides", "generation", "default_model"],
      overlay: ["overrides", "generation", "default_model"],
    },
  }),
  logLevel: defineSetting({
    schema: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
    description:
      "Minimum logging level for the Command Client, including Overlay subprocesses.",
    defaultValue: "info",
    example: "debug",
    paths: {
      global: ["logging", "level"],
      cli: ["overrides", "logging", "level"],
    },
  }),
  ocrLanguages: defineSetting({
    schema: z.array(z.string().regex(/^[^\s+/]+(?:\/[^\s+/]+)*$/)).min(1),
    description:
      "Ordered Tesseract language identifiers. Replaces the complete inherited list.",
    defaultValue: Object.freeze(["eng"]),
    example: Object.freeze(["eng", "pol"]),
    paths: { overlay: ["ocr", "languages"] },
  }),
} as const;

export const loadChains = {
  cli: Object.freeze(["global", "cli"] as const),
  overlay: Object.freeze(["global", "cli", "overlay"] as const),
} as const;
