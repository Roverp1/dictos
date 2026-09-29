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
    { name: "missing separator", value: "openai" },
    { name: "empty Provider ID", value: "/gpt-4" },
    { name: "empty Model ID", value: "openai/" },
    { name: "ASCII escape", value: "openai/gpt\u001b[31m" },
    { name: "C1 escape", value: "openai/gpt\u009b[31m" },
    { name: "bidirectional formatting", value: "openai/gpt\u202eunsafe" },
    { name: "uppercase Provider ID", value: "OpenAI/gpt-4" },
  ])("rejects $name", ({ value }) => {
    expect(parseQualifiedModelId(value)).toBeInstanceOf(ValidationError);
  });
});
