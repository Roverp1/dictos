import { configurationSnapshotSchema, validationError } from "./schemas";
import type { ConfigurationError, ConfigurationSnapshot } from "./schemas";

export function validateConfigurationSnapshot(input: {
  value: unknown;
}): ConfigurationSnapshot | ConfigurationError {
  const parsed = configurationSnapshotSchema.safeParse(input.value);
  if (!parsed.success)
    return validationError({
      kind: "snapshot",
      source: "startup snapshot",
      issues: parsed.error.issues,
    });
  return parsed.data;
}
