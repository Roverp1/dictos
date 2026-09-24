import type { LogWarningsFunction, Warning } from "ai";
import type { Logger } from "@dictos/logger";

type AiSdkGlobal = typeof globalThis & {
  AI_SDK_LOG_WARNINGS?: false | LogWarningsFunction;
};

export function configureAiSdkWarningLogging(logger: Logger): () => void {
  const aiSdkGlobal = globalThis as AiSdkGlobal;
  const previousLogger = aiSdkGlobal.AI_SDK_LOG_WARNINGS;
  aiSdkGlobal.AI_SDK_LOG_WARNINGS = ({ warnings, provider, model }) => {
    logger.warn("AI SDK provider warnings received", {
      provider,
      model,
      warningCount: warnings.length,
      warnings: warnings.map(sanitizeAiSdkWarning),
    });
  };
  return () => {
    if (previousLogger === undefined) {
      delete aiSdkGlobal.AI_SDK_LOG_WARNINGS;
      return;
    }
    aiSdkGlobal.AI_SDK_LOG_WARNINGS = previousLogger;
  };
}

function sanitizeAiSdkWarning(warning: Warning) {
  if (warning.type === "unsupported" || warning.type === "compatibility")
    return { type: warning.type, feature: warning.feature };
  return { type: warning.type };
}
