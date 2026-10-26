import { ConfigurationError, type ConfigurationIssue } from "@dictos/config";

export function configurationFailure(input: {
  kind: ConfigurationIssue["kind"];
  source: string;
  message: string;
  cause?: unknown;
  line?: number | null;
  column?: number | null;
}) {
  return new ConfigurationError({
    issues: [
      {
        kind: input.kind,
        source: input.source,
        keyPath: [],
        line: input.line ?? null,
        column: input.column ?? null,
        message: input.message,
      },
    ],
    cause: input.cause,
  });
}

export function hasCode(cause: unknown, code: string): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === code
  );
}
