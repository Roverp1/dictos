import { z } from "zod";
import * as errore from "@dictos/errore";
import { ConfigurationError, configurationSchemas } from "../src/schemas";

const filenames = {
  global: "config.schema.json",
  cli: "cli.schema.json",
  overlay: "overlay.schema.json",
} as const;
const failure = (source: string, cause?: unknown) =>
  new ConfigurationError({
    issues: [
      {
        kind: "initialize",
        source,
        keyPath: [],
        line: null,
        column: null,
        message: "Schema generation or drift check failed.",
      },
    ],
    cause,
  });

async function main(): Promise<null | ConfigurationError> {
  for (const scope of ["global", "cli", "overlay"] as const) {
    const filename = filenames[scope];
    const generated = errore.try(
      () =>
        JSON.stringify(
          z.toJSONSchema(configurationSchemas[scope], {
            target: "draft-04",
            io: "input",
            reused: "inline",
          }),
          null,
          2
        ) + "\n",
      (cause) => failure(filename, cause)
    );
    if (generated instanceof Error) return generated;
    const file = new URL(`../schemas/${filename}`, import.meta.url);
    if (Bun.argv.includes("--check")) {
      const existing = await Bun.file(file)
        .text()
        .catch((cause) => failure(filename, cause));
      if (existing instanceof Error) return existing;
      if (existing !== generated) return failure(filename);
      continue;
    }
    const written = await Bun.write(file, generated).catch((cause) =>
      failure(filename, cause)
    );
    if (written instanceof Error) return written;
  }
  return null;
}

const result = await main();
if (result instanceof Error) {
  console.error(
    "Configuration schema is missing or stale:",
    result.issues[0]?.source,
    "Run generate:schemas."
  );
  process.exitCode = 1;
}
