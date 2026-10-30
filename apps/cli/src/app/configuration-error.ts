import { ConfigurationError, type ConfigurationIssue } from "@dictos/config";

export type ConfigurationFailureResponse = {
  ok: false;
  error: {
    code: "CONFIGURATION_ERROR";
    message: string;
    issues: readonly ConfigurationIssue[];
  };
};

const safeText = (text: string) =>
  text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");

export function configurationFailureResponse({
  error,
}: {
  error: ConfigurationError;
}): ConfigurationFailureResponse {
  const issues: readonly ConfigurationIssue[] =
    error.issues.length > 0
      ? error.issues
      : [
          {
            kind: "validate",
            source: "configuration",
            keyPath: [],
            line: null,
            column: null,
            message:
              "Configuration could not be loaded; check your configuration files.",
          },
        ];
  const first = issues[0]!;
  const location =
    first.line === null
      ? ""
      : `:${first.line}${first.column === null ? "" : `:${first.column}`}`;
  const key = first.keyPath.length === 0 ? "" : ` (${first.keyPath.join(".")})`;
  const remaining =
    issues.length > 1
      ? ` (${issues.length - 1} more issue${issues.length === 2 ? "" : "s"})`
      : "";
  return {
    ok: false,
    error: {
      code: "CONFIGURATION_ERROR",
      message: safeText(
        `${first.source}${location}${key}: ${first.message}${remaining}`
      ),
      issues,
    },
  };
}
