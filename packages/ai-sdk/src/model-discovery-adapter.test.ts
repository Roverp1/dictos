import { describe, expect, test } from "bun:test";
import { ModelDiscoveryError } from "@dictos/core";
import type { Context, Logger } from "@dictos/logger";

import { OpenAiCompatibleModelDiscoveryAdapter } from "./model-discovery-adapter";

const connection = {
  id: "connection-1",
  name: "Local provider",
  presetId: null,
  baseUrl: "https://provider.example/v1/",
  apiKey: "top-secret-key",
};

type ErrorEvent = {
  message: string;
  error: unknown;
  context: Context | undefined;
};

function createRecordingLogger() {
  const errorEvents: ErrorEvent[] = [];
  const infoEvents: { message: string; context: Context | undefined }[] = [];
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: (message, context) => infoEvents.push({ message, context }),
    warn: () => {},
    error: (message, error, context) =>
      errorEvents.push({ message, error, context }),
    fatal: () => {},
    child: () => logger,
  };
  return { errorEvents, infoEvents, logger };
}

describe("OpenAiCompatibleModelDiscoveryAdapter", () => {
  test("discovers unique sorted model IDs from an OpenAI-compatible provider", async () => {
    const { infoEvents, logger } = createRecordingLogger();
    const adapter = new OpenAiCompatibleModelDiscoveryAdapter({
      logger,
      fetchImplementation: async (url, init) => {
        expect(url).toBe("https://provider.example/v1/models");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer top-secret-key"
        );
        return Response.json({
          data: [{ id: "zeta" }, { id: "alpha" }, { id: "zeta" }],
        });
      },
    });

    expect(await adapter.listModels(connection)).toEqual(["alpha", "zeta"]);
    expect(infoEvents[0]).toMatchObject({
      message: "Model discovery completed",
      context: {
        providerConnectionId: "connection-1",
        modelCount: 2,
      },
    });
  });

  test("returns actionable authentication errors with safe diagnostics", async () => {
    const { errorEvents, logger } = createRecordingLogger();
    const adapter = new OpenAiCompatibleModelDiscoveryAdapter({
      logger,
      fetchImplementation: async () =>
        Response.json(
          { error: { message: "invalid top-secret-key" } },
          { status: 401 }
        ),
    });

    const result = await adapter.listModels(connection);
    expect(result).toBeInstanceOf(ModelDiscoveryError);
    if (!(result instanceof ModelDiscoveryError)) return;
    expect(result.reason).toBe(
      "Provider authentication failed. Replace the API key."
    );
    expect(errorEvents[0]).toMatchObject({
      message: "Model discovery failed",
      error: result,
      context: {
        providerConnectionId: "connection-1",
        statusCode: 401,
      },
    });
    expect(JSON.stringify(errorEvents[0])).not.toContain("top-secret-key");
  });

  test("sanitizes credentials when the provider request fails", async () => {
    const { errorEvents, logger } = createRecordingLogger();
    const adapter = new OpenAiCompatibleModelDiscoveryAdapter({
      logger,
      fetchImplementation: async () =>
        Promise.reject(new Error("request failed with top-secret-key")),
    });

    const result = await adapter.listModels(connection);
    expect(result).toBeInstanceOf(ModelDiscoveryError);
    if (!(result instanceof ModelDiscoveryError)) return;
    expect(result.reason).toBe(
      "Could not reach the provider. Check the Provider Connection and network."
    );
    expect(result.message).not.toContain("top-secret-key");
    expect(result.cause).toBeInstanceOf(Error);
    if (!(result.cause instanceof Error)) return;
    expect(result.cause.message).toBe("Provider request failed");
    expect(result.cause.message).not.toContain("top-secret-key");
    expect(errorEvents[0]?.error).toBe(result);
    expect(JSON.stringify(errorEvents[0])).not.toContain("top-secret-key");
  });
});
