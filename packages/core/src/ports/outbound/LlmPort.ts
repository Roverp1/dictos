import type { LlmError } from "../../errors";

export interface LlmPort {
  generateDefinition(
    captureText: string,
    promptText: string
  ): Promise<string | LlmError>;
}
