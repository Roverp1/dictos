import { describe, expect, test } from "bun:test";
import {
  DescriptionGenerationError,
  type DescriptionGenerationRequest,
} from "@dictos/core";

import { AiSdkDescriptionGenerationAdapter } from "./description-generation-adapter";

const request: DescriptionGenerationRequest = {
  connection: {
    id: "connection-1",
    name: "Local provider",
    presetId: null,
    baseUrl: "https://provider.example/v1",
    apiKey: "top-secret-key",
  },
  modelId: "test-model",
  instruction: "Generate a translation.",
  entry: { id: "entry-1", text: "hello" },
  sourceDescription: {
    id: "description-1",
    text: "hello",
    type: "misc",
    senseId: null,
  },
  targetTypes: ["translation"],
  target: { kind: "new", existingSenses: [] },
};

describe("AiSdkDescriptionGenerationAdapter", () => {
  test("returns a proposal from an OpenAI-compatible JSON response", async () => {
    const adapter = new AiSdkDescriptionGenerationAdapter(async (url, init) => {
      expect(url).toBe("https://provider.example/v1/chat/completions");
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer top-secret-key"
      );
      return Response.json({
        id: "completion-1",
        object: "chat.completion",
        created: 0,
        model: "test-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                senseName: "greeting",
                duplicateCandidateSenseId: null,
                descriptions: [{ type: "translation", text: "bonjour" }],
              }),
            },
          },
        ],
      });
    });

    expect(await adapter.generate(request)).toEqual({
      target: {
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: null,
      },
      descriptions: [{ type: "translation", text: "bonjour" }],
    });
  });

  test("returns a sanitized error when a provider request fails", async () => {
    const adapter = new AiSdkDescriptionGenerationAdapter(async () =>
      Promise.reject(new Error("request failed with top-secret-key"))
    );

    const result = await adapter.generate(request);
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    if (!(result instanceof DescriptionGenerationError)) return;
    expect(result.message).not.toContain("top-secret-key");
    expect(result.cause).toBeInstanceOf(Error);
    if (!(result.cause instanceof Error)) return;
    expect(result.cause.message).toBe("Provider request failed");
    expect(result.cause.message).not.toContain("top-secret-key");
  });
});
