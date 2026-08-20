import { describe, expect, test } from "bun:test";
import { ModelDiscoveryError } from "@dictos/core";

import { OpenAiCompatibleModelDiscoveryAdapter } from "./model-discovery-adapter";

const connection = {
  id: "connection-1",
  name: "Local provider",
  presetId: null,
  baseUrl: "https://provider.example/v1/",
  apiKey: "top-secret-key",
};

describe("OpenAiCompatibleModelDiscoveryAdapter", () => {
  test("discovers unique sorted model IDs from an OpenAI-compatible provider", async () => {
    const adapter = new OpenAiCompatibleModelDiscoveryAdapter(
      async (url, init) => {
        expect(url).toBe("https://provider.example/v1/models");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer top-secret-key"
        );
        return Response.json({
          data: [{ id: "zeta" }, { id: "alpha" }, { id: "zeta" }],
        });
      }
    );

    expect(await adapter.listModels(connection)).toEqual(["alpha", "zeta"]);
  });

  test("sanitizes credentials when the provider request fails", async () => {
    const adapter = new OpenAiCompatibleModelDiscoveryAdapter(async () =>
      Promise.reject(new Error("request failed with top-secret-key"))
    );

    const result = await adapter.listModels(connection);
    expect(result).toBeInstanceOf(ModelDiscoveryError);
    if (!(result instanceof ModelDiscoveryError)) return;
    expect(result.message).not.toContain("top-secret-key");
    expect(result.cause).toBeInstanceOf(Error);
    if (!(result.cause instanceof Error)) return;
    expect(result.cause.message).toBe("Provider request failed");
    expect(result.cause.message).not.toContain("top-secret-key");
  });
});
