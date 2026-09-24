import { describe, expect, test } from "bun:test";
import {
  DescriptionGenerationError,
  type DescriptionGenerationRequest,
} from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { configureAiSdkWarningLogging } from "./ai-sdk-warning-logger";
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

type ErrorEvent = {
  message: string;
  error: unknown;
  context: Context | undefined;
};

function createRecordingLogger() {
  const errorEvents: ErrorEvent[] = [];
  const infoEvents: { message: string; context: Context | undefined }[] = [];
  const warningEvents: { message: string; context: Context | undefined }[] = [];
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: (message, context) => infoEvents.push({ message, context }),
    warn: (message, context) => warningEvents.push({ message, context }),
    error: (message, error, context) =>
      errorEvents.push({ message, error, context }),
    fatal: () => {},
    child: () => logger,
  };
  return { errorEvents, infoEvents, logger, warningEvents };
}

describe("AiSdkDescriptionGenerationAdapter", () => {
  test("requests DeepSeek-compatible JSON with the required proposal shape", async () => {
    const requestBodies: string[] = [];
    const { logger } = createRecordingLogger();
    const restoreWarningLogging = configureAiSdkWarningLogging(logger);
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (_url, init) => {
        requestBodies.push(String(init?.body));
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
      },
    });

    const result = await adapter
      .generate(request)
      .finally(restoreWarningLogging);
    if (result instanceof Error) throw result;
    const body = JSON.parse(requestBodies[0] ?? "null") as {
      max_tokens?: unknown;
      response_format?: unknown;
      messages?: { content?: string }[];
    };
    const messages = body.messages
      ?.map((message) => message.content ?? "")
      .join("\n");

    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBe(4096);
    expect(messages?.toLowerCase()).toContain("json");
    expect(messages?.toLowerCase()).toContain("example");
    expect(messages).toContain('"senseName"');
    expect(messages).toContain('"duplicateCandidateSenseId"');
    expect(messages).toContain('"descriptions"');
  });

  test("returns a proposal from an OpenAI-compatible JSON response", async () => {
    const { infoEvents, logger, warningEvents } = createRecordingLogger();
    const restoreWarningLogging = configureAiSdkWarningLogging(logger);
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (url, init) => {
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
      },
    });

    const result = await adapter
      .generate(request)
      .finally(restoreWarningLogging);
    expect(result).toEqual({
      target: {
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: null,
      },
      descriptions: [{ type: "translation", text: "bonjour" }],
    });
    expect(infoEvents[0]).toMatchObject({
      message: "Description Generation provider request completed",
      context: {
        providerConnectionId: "connection-1",
        modelId: "test-model",
        targetKind: "new",
        descriptionCount: 1,
      },
    });
    expect(warningEvents[0]).toEqual({
      message: "AI SDK provider warnings received",
      context: {
        provider: "dictos-provider.chat",
        model: "test-model",
        warningCount: 1,
        warnings: [{ type: "unsupported", feature: "responseFormat" }],
      },
    });
  });

  test("retries a retryable provider failure at most twice", async () => {
    const { errorEvents, logger } = createRecordingLogger();
    let attemptCount = 0;
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () => {
        attemptCount += 1;
        return Response.json(
          { error: { message: "temporarily unavailable" } },
          {
            status: 503,
            headers: { "retry-after-ms": "0" },
          }
        );
      },
    });

    const result = await adapter.generate(request);
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    if (!(result instanceof DescriptionGenerationError)) return;
    expect(attemptCount).toBe(3);
    expect(result.reason).toBe("Provider is unavailable. Try again later.");
    expect(errorEvents[0]).toMatchObject({
      error: result,
      context: { statusCode: 503, retryable: true, maxRetries: 2 },
    });
  });

  test("returns actionable authentication errors and logs safe diagnostics", async () => {
    const { errorEvents, logger } = createRecordingLogger();
    let attemptCount = 0;
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () => {
        attemptCount += 1;
        return Response.json(
          {
            error: {
              message: "invalid API key top-secret-key",
              type: "authentication_error",
              code: "invalid_api_key",
            },
          },
          { status: 401 }
        );
      },
    });

    const result = await adapter.generate(request);
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    if (!(result instanceof DescriptionGenerationError)) return;
    expect(result.reason).toBe(
      "Provider authentication failed. Replace the API key."
    );
    expect(attemptCount).toBe(1);
    expect(result.message).not.toContain("top-secret-key");
    expect(errorEvents[0]).toMatchObject({
      message: "Description Generation provider request failed",
      error: result,
      context: {
        providerConnectionId: "connection-1",
        modelId: "test-model",
        targetKind: "new",
        statusCode: 401,
      },
    });
    expect(JSON.stringify(errorEvents[0])).not.toContain("top-secret-key");
  });

  test("explains when a provider rejects the generation request", async () => {
    const { logger } = createRecordingLogger();
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () =>
        Response.json(
          {
            error: {
              message: "Prompt must contain the word json",
              type: "invalid_request_error",
            },
          },
          { status: 400 }
        ),
    });

    const result = await adapter.generate(request);
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    if (!(result instanceof DescriptionGenerationError)) return;
    expect(result.reason).toBe(
      "Provider rejected the request. Check the Model and Provider Connection."
    );
  });

  test("returns a sanitized error when a provider request fails", async () => {
    const { errorEvents, logger } = createRecordingLogger();
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () =>
        Promise.reject(new Error("request failed with top-secret-key")),
    });

    const result = await adapter.generate(request);
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    if (!(result instanceof DescriptionGenerationError)) return;
    expect(result.reason).toBe(
      "Could not reach the provider. Check the Provider Connection and network."
    );
    expect(result.message).not.toContain("top-secret-key");
    expect(result.cause).toBeInstanceOf(Error);
    if (!(result.cause instanceof Error)) return;
    expect(result.cause.message).toBe("Provider request failed");
    expect(result.cause.message).not.toContain("top-secret-key");
    expect(errorEvents[0]?.error).toBe(result);
    expect((errorEvents[0]?.error as Error).message).not.toContain(
      "top-secret-key"
    );
    expect(JSON.stringify(errorEvents[0])).not.toContain("top-secret-key");
  });
});
