import { describe, expect, test } from "bun:test";
import {
  DescriptionGenerationError,
  type DescriptionGenerationRequest,
  InvalidGenerationResponseError,
} from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { configureAiSdkWarningLogging } from "./ai-sdk-warning-logger";
import { AiSdkDescriptionGenerationAdapter } from "./description-generation-adapter";

const request: DescriptionGenerationRequest = {
  connection: {
    providerId: "deepseek",
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
  test("Google returns a new Sense proposal with a null duplicate candidate", async () => {
    const requests: { url: string; body: unknown; headers: Headers }[] = [];
    const { logger } = createRecordingLogger();
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (url, init) => {
        requests.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
        });
        return Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      senseName: "greeting",
                      duplicateCandidateSenseId: null,
                      descriptions: [{ type: "translation", text: "bonjour" }],
                    }),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        });
      },
    });

    const result = await adapter.generate({
      ...request,
      connection: { ...request.connection, providerId: "google" },
    });
    expect(result).toEqual({
      target: {
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: null,
      },
      descriptions: [{ type: "translation", text: "bonjour" }],
    });
    expect(requests[0]?.url).toContain("generativelanguage.googleapis.com");
    expect(requests[0]?.headers.get("x-goog-api-key")).toBe("top-secret-key");
    expect(requests[0]?.body).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
    expect(
      (requests[0]?.body as { generationConfig: { responseSchema?: unknown } })
        .generationConfig.responseSchema
    ).toBeUndefined();
  });
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

  test("returns a proposal from the fixed DeepSeek endpoint", async () => {
    const { infoEvents, logger, warningEvents } = createRecordingLogger();
    const restoreWarningLogging = configureAiSdkWarningLogging(logger);
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (url, init) => {
        expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
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
        providerId: "deepseek",
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

  test.each([
    ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
    ["groq", "https://api.groq.com/openai/v1/chat/completions"],
  ])(
    "routes %s to its fixed compatible endpoint",
    async (providerId, endpoint) => {
      const { logger } = createRecordingLogger();
      const restoreWarningLogging = configureAiSdkWarningLogging(logger);
      const urls: string[] = [];
      const adapter = new AiSdkDescriptionGenerationAdapter({
        logger,
        fetchImplementation: async (url, init) => {
          urls.push(String(url));
          expect(new Headers(init?.headers).get("Authorization")).toBe(
            "Bearer top-secret-key"
          );
          expect(JSON.parse(String(init?.body)).response_format).toEqual({
            type: "json_object",
          });
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
        .generate({
          ...request,
          connection: { providerId, apiKey: "top-secret-key" },
        })
        .finally(restoreWarningLogging);
      if (result instanceof Error) throw result;
      expect(result.target).toEqual({
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: null,
      });
      expect(urls).toEqual([endpoint]);
    }
  );

  test("native OpenAI uses its structured response request mode", async () => {
    const { logger } = createRecordingLogger();
    const requests: { url: string; body: unknown }[] = [];
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (url, init) => {
        requests.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
        });
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
    const result = await adapter.generate({
      ...request,
      connection: { providerId: "openai", apiKey: "top-secret-key" },
    });
    if (result instanceof Error) throw result;
    expect(result.target).toEqual({
      kind: "new",
      senseName: "greeting",
      duplicateCandidateSenseId: null,
    });
    expect(requests).toEqual([
      {
        url: "https://api.openai.com/v1/chat/completions",
        body: expect.objectContaining({
          response_format: expect.objectContaining({ type: "json_schema" }),
        }),
      },
    ]);
  });

  test("native OpenAI sends a nullable duplicate candidate schema and the exact Model ID", async () => {
    const { logger } = createRecordingLogger();
    const requests: unknown[] = [];
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return Response.json({
          id: "completion-1",
          object: "chat.completion",
          created: 0,
          model: "org/test-model",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  senseName: "greeting",
                  duplicateCandidateSenseId: "sense-1",
                  descriptions: [{ type: "translation", text: "bonjour" }],
                }),
              },
            },
          ],
        });
      },
    });

    const result = await adapter.generate({
      ...request,
      modelId: "org/test-model",
      connection: { ...request.connection, providerId: "openai" },
      target: {
        kind: "new",
        existingSenses: [{ id: "sense-1", name: "greeting", descriptions: [] }],
      },
    });
    expect(result).toEqual({
      target: {
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: "sense-1",
      },
      descriptions: [{ type: "translation", text: "bonjour" }],
    });
    expect(requests).toEqual([
      expect.objectContaining({
        model: "org/test-model",
        response_format: expect.objectContaining({
          type: "json_schema",
          json_schema: expect.objectContaining({
            schema: expect.objectContaining({
              properties: expect.objectContaining({
                duplicateCandidateSenseId: expect.objectContaining({
                  type: ["string", "null"],
                }),
              }),
            }),
          }),
        }),
      }),
    ]);
  });

  test("Google uses JSON text mode without a response schema and preserves a duplicate candidate", async () => {
    const { logger } = createRecordingLogger();
    const requests: { url: string; body: unknown; headers: Headers }[] = [];
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async (url, init) => {
        requests.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
        });
        return Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      senseName: "greeting",
                      duplicateCandidateSenseId: "sense-1",
                      descriptions: [{ type: "translation", text: "bonjour" }],
                    }),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        });
      },
    });

    const result = await adapter.generate({
      ...request,
      modelId: "gemini-test",
      connection: { ...request.connection, providerId: "google" },
      target: {
        kind: "new",
        existingSenses: [{ id: "sense-1", name: "greeting", descriptions: [] }],
      },
    });
    expect(result).toEqual({
      target: {
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: "sense-1",
      },
      descriptions: [{ type: "translation", text: "bonjour" }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain("/models/gemini-test:generateContent");
    expect(requests[0]?.headers.get("x-goog-api-key")).toBe("top-secret-key");
    expect(requests[0]?.body).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
    expect(JSON.stringify(requests[0]?.body)).not.toContain("responseSchema");
  });

  test.each([
    ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
    ["deepseek", "https://api.deepseek.com/v1/chat/completions"],
    ["groq", "https://api.groq.com/openai/v1/chat/completions"],
  ])(
    "%s sends the unqualified Model ID in a compatible JSON request",
    async (providerId, endpoint) => {
      const { logger } = createRecordingLogger();
      const restoreWarningLogging = configureAiSdkWarningLogging(logger);
      const requests: { url: string; body: unknown; headers: Headers }[] = [];
      const adapter = new AiSdkDescriptionGenerationAdapter({
        logger,
        fetchImplementation: async (url, init) => {
          requests.push({
            url: String(url),
            body: JSON.parse(String(init?.body)),
            headers: new Headers(init?.headers),
          });
          return Response.json({
            id: "completion-1",
            object: "chat.completion",
            created: 0,
            model: "org/test-model",
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
        .generate({
          ...request,
          modelId: "org/test-model",
          connection: { ...request.connection, providerId },
        })
        .finally(restoreWarningLogging);
      if (result instanceof Error) throw result;
      expect(result.target).toEqual({
        kind: "new",
        senseName: "greeting",
        duplicateCandidateSenseId: null,
      });
      expect(requests).toEqual([
        {
          url: endpoint,
          headers: expect.any(Headers),
          body: expect.objectContaining({
            model: "org/test-model",
            response_format: { type: "json_object" },
          }),
        },
      ]);
      expect(requests[0]?.headers.get("Authorization")).toBe(
        "Bearer top-secret-key"
      );
    }
  );

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

  test("recovers from a retryable failure without a second generation invocation", async () => {
    const { logger } = createRecordingLogger();
    const statuses: number[] = [];
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () => {
        const response =
          statuses.length === 0
            ? Response.json(
                { error: { message: "temporary outage" } },
                {
                  status: 503,
                  headers: { "retry-after-ms": "0" },
                }
              )
            : Response.json({
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
                        descriptions: [
                          { type: "translation", text: "bonjour" },
                        ],
                      }),
                    },
                  },
                ],
              });
        statuses.push(response.status);
        return response;
      },
    });
    const restoreWarningLogging = configureAiSdkWarningLogging(logger);
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
    expect(statuses).toEqual([503, 200]);
  });

  test.each(["openai", "google", "openrouter", "deepseek", "groq"])(
    "%s rejects a credential-bearing HTTP error without exposing its payload",
    async (providerId) => {
      const { errorEvents, logger, warningEvents } = createRecordingLogger();
      const rawPayload = "raw-provider-payload-do-not-log";
      const adapter = new AiSdkDescriptionGenerationAdapter({
        logger,
        fetchImplementation: async () =>
          new Response(
            JSON.stringify({
              error: { message: `invalid key top-secret-key ${rawPayload}` },
            }),
            { status: 401, headers: { "content-type": "application/json" } }
          ),
      });
      const restoreWarningLogging = configureAiSdkWarningLogging(logger);
      const result = await adapter
        .generate({
          ...request,
          connection: { ...request.connection, providerId },
        })
        .finally(restoreWarningLogging);
      expect(result).toBeInstanceOf(DescriptionGenerationError);
      if (!(result instanceof DescriptionGenerationError)) return;
      expect(result.reason).toBe(
        "Provider authentication failed. Replace the API key."
      );
      expect(result.cause).toBeInstanceOf(Error);
      expect(result.cause instanceof Error ? result.cause.message : "").toBe(
        "Provider returned HTTP 401"
      );
      const diagnostics = JSON.stringify({
        reason: result.reason,
        message: result.message,
        cause:
          result.cause instanceof Error
            ? { message: result.cause.message, stack: result.cause.stack }
            : result.cause,
        errorEvents: errorEvents.map(({ message, error, context }) => ({
          message,
          context,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
        })),
        warningEvents,
      });
      expect(diagnostics).not.toContain("top-secret-key");
      expect(diagnostics).not.toContain(rawPayload);
      expect(errorEvents[0]).toMatchObject({
        error: result,
        context: { providerId, statusCode: 401 },
      });
    }
  );

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
        providerId: "deepseek",
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

  test("rejects malformed provider proposals without exposing raw output", async () => {
    const { errorEvents, logger } = createRecordingLogger();
    const restoreWarningLogging = configureAiSdkWarningLogging(logger);
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () =>
        Response.json({
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
                  duplicateCandidateSenseId: 123,
                  descriptions: [
                    { type: "translation", text: "top-secret-key" },
                  ],
                }),
              },
            },
          ],
        }),
    });

    const result = await adapter
      .generate(request)
      .finally(restoreWarningLogging);
    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
    expect(JSON.stringify(errorEvents)).not.toContain("top-secret-key");
  });

  test.each(["openai", "google"])(
    "%s rejects an invalid proposal without exposing the raw response",
    async (providerId) => {
      const { errorEvents, logger } = createRecordingLogger();
      const rawPayload = "raw-provider-output-do-not-log";
      const proposal = JSON.stringify({
        senseName: "greeting",
        duplicateCandidateSenseId: 123,
        descriptions: [{ type: "translation", text: rawPayload }],
      });
      const adapter = new AiSdkDescriptionGenerationAdapter({
        logger,
        fetchImplementation: async () =>
          providerId === "google"
            ? Response.json({
                candidates: [
                  {
                    content: { role: "model", parts: [{ text: proposal }] },
                    finishReason: "STOP",
                  },
                ],
              })
            : Response.json({
                id: "completion-1",
                object: "chat.completion",
                created: 0,
                model: "test-model",
                choices: [
                  {
                    index: 0,
                    finish_reason: "stop",
                    message: { role: "assistant", content: proposal },
                  },
                ],
              }),
      });
      const result = await adapter.generate({
        ...request,
        connection: { ...request.connection, providerId },
      });
      expect(result).toBeInstanceOf(InvalidGenerationResponseError);
      if (!(result instanceof InvalidGenerationResponseError)) return;
      const diagnostics = JSON.stringify({
        message: result.message,
        reason: result.reason,
        cause:
          result.cause instanceof Error ? result.cause.message : result.cause,
        events: errorEvents.map(({ message, context, error }) => ({
          message,
          context,
          error: error instanceof Error ? error.message : error,
        })),
      });
      expect(diagnostics).not.toContain(rawPayload);
      expect(errorEvents[0]).toMatchObject({
        error: result,
        context: { providerId },
      });
    }
  );

  test("rejects unsupported provider IDs without sending credentials", async () => {
    const { logger } = createRecordingLogger();
    let sent = false;
    const adapter = new AiSdkDescriptionGenerationAdapter({
      logger,
      fetchImplementation: async () => {
        sent = true;
        return Response.json({});
      },
    });
    const result = await adapter.generate({
      ...request,
      connection: { providerId: "unknown", apiKey: "top-secret-key" },
    });
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    expect(sent).toBe(false);
  });
});
