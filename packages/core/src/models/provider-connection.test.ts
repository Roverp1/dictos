import { describe, expect, test } from "bun:test";

import { ValidationError } from "../errors";
import { parseQualifiedModelId } from "./provider-connection";

describe("parseQualifiedModelId", () => {
  test("keeps slashes inside a provider-specific Model ID", () => {
    expect(parseQualifiedModelId("openrouter/anthropic/claude-3")).toEqual({
      providerId: "openrouter",
      modelId: "anthropic/claude-3",
    });
  });

  test.each([
    "openai",
    "/gpt-4",
    "openai/",
    "openai/gpt\u001b[31m",
    "OpenAI/gpt-4",
  ])("rejects an invalid qualified Model ID: %s", (value) => {
    expect(parseQualifiedModelId(value)).toBeInstanceOf(ValidationError);
  });
});
