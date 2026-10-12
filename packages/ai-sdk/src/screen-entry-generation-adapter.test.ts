import { describe, expect, test } from "bun:test";
import {
  DescriptionGenerationError,
  InvalidGenerationResponseError,
  type GenerationDraft,
  type ScreenEntryGenerationPort,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";

import { AiSdkScreenEntryGenerationAdapter } from "./screen-entry-generation-adapter";

function fixture(reply: unknown, status = 200) {
  const bodies: string[] = [];
  const urls: string[] = [];
  const errors: unknown[] = [];
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (_message, error, context) => errors.push({ error, context }),
    fatal: () => {},
    child: () => logger,
  };
  const adapter: ScreenEntryGenerationPort =
    new AiSdkScreenEntryGenerationAdapter({
      logger,
      fetchImplementation: async (url, init) => {
        urls.push(String(url));
        bodies.push(String(init?.body));
        return status === 200
          ? Response.json({
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
                    content:
                      typeof reply === "string" ? reply : JSON.stringify(reply),
                  },
                },
              ],
            })
          : Response.json(reply, {
              status,
              headers: { "retry-after-ms": "0" },
            });
      },
    });
  return { adapter, bodies, urls, errors };
}

const base = {
  connection: { providerId: "deepseek", apiKey: "top-secret-key" },
  modelId: "test-model",
  entryText: "zażółć gęślą jaźń",
  descriptionText: null,
  instructionText: "",
};
const generate = {
  ...base,
  senseName: null,
  existingDescriptions: [],
  targetTypes: ["definition", "translation"] as (
    "definition" | "translation"
  )[],
};

describe("AiSdkScreenEntryGenerationAdapter", () => {
  test("suggests at most 20 distinct Senses with definition previews from an Entry alone", async () => {
    const candidates = Array.from({ length: 23 }, (_, i) => ({
      name: `Sens ${i}`,
      definition: `Opis ${i}`,
    }));
    candidates.push({ name: "Sens 0", definition: "Drugi opis" });
    const { adapter, bodies, urls } = fixture({ senses: candidates });
    const result = await adapter.suggestSenses({ ...base, limit: 20 });
    if (result instanceof Error) throw result;
    expect(result).toEqual(candidates.slice(0, 20));
    expect(urls).toEqual(["https://api.deepseek.com/v1/chat/completions"]);
    expect(bodies[0]).toContain("zażółć gęślą jaźń");
    const prompt = JSON.parse(
      JSON.parse(bodies[0] ?? "null").messages[1].content
    );
    expect(prompt.descriptionText).toBeNull();
    expect(prompt.instructionText).toBe("");
  });

  test.each([
    [{ senses: [{ name: " ", definition: "opis" }] }, "blank name"],
    [{ senses: [{ name: "Sense", definition: "  " }] }, "blank preview"],
    [
      { senses: [{ name: "Sense", definition: "x".repeat(241) }] },
      "long preview",
    ],
    [
      {
        senses: [
          { name: "Sense", definition: "one" },
          { name: " sense ", definition: "two" },
        ],
      },
      "duplicate name",
    ],
    [{ senses: "bad" }, "malformed list"],
  ])("rejects %s suggestions", async (reply) => {
    const { adapter } = fixture(reply);
    expect(await adapter.suggestSenses({ ...base, limit: 20 })).toBeInstanceOf(
      InvalidGenerationResponseError
    );
  });

  test("generates requested Types with Polish text and a proposed Sense", async () => {
    const { adapter, bodies } = fixture({
      senseName: "Znaczenie",
      descriptions: [
        { type: "definition", text: "Gęślą i jaźnią" },
        { type: "translation", text: "Żółć" },
      ],
    });
    expect(await adapter.generateDescriptions(generate)).toEqual({
      senseName: "Znaczenie",
      descriptions: [
        { type: "definition", text: "Gęślą i jaźnią" },
        { type: "translation", text: "Żółć" },
      ],
    });
    expect(
      JSON.parse(JSON.parse(bodies[0] ?? "null").messages[1].content).senseName
    ).toBeNull();
  });

  test("returns multiple Descriptions of a requested Type while covering every requested Type", async () => {
    const descriptions: GenerationDraft["descriptions"] = [
      { type: "definition", text: "Pierwsza definicja" },
      { type: "definition", text: "Druga definicja" },
      { type: "translation", text: "Tłumaczenie" },
    ];
    const { adapter } = fixture({ senseName: "Znaczenie", descriptions });
    expect(await adapter.generateDescriptions(generate)).toEqual({
      senseName: "Znaczenie",
      descriptions,
    });
  });

  test("preserves a supplied Sense and includes captured and manual Descriptions as context", async () => {
    const { adapter, bodies } = fixture({
      descriptions: [
        { type: "definition", text: "Definicja" },
        { type: "translation", text: "Tłumaczenie" },
      ],
    });
    const result = await adapter.generateDescriptions({
      ...generate,
      senseName: "Mój sens",
      descriptionText: "Przykładowy opis",
      existingDescriptions: [{ type: "example", text: "Ręcznie" }],
      instructionText: "Po polsku",
    });
    if (result instanceof Error) throw result;
    expect(result.senseName).toBe("Mój sens");
    expect(bodies[0]).toContain("Przykładowy opis");
    expect(bodies[0]).toContain("Ręcznie");
    expect(bodies[0]).toContain("Po polsku");
  });

  test.each([
    [
      {
        senseName: "Sense",
        descriptions: [{ type: "definition", text: "opis" }],
      },
      "missing Type",
    ],
    [
      {
        senseName: "Sense",
        descriptions: [
          { type: "definition", text: "opis" },
          { type: "translation", text: " " },
        ],
      },
      "blank Description",
    ],
    [
      {
        senseName: "Sense",
        descriptions: [
          { type: "definition", text: "opis" },
          { type: "example", text: "extra" },
          { type: "translation", text: "text" },
        ],
      },
      "unrequested Type",
    ],
    [
      {
        senseName: " ",
        descriptions: [
          { type: "definition", text: "opis" },
          { type: "translation", text: "text" },
        ],
      },
      "blank Sense",
    ],
    ["not-json", "malformed JSON"],
  ])("rejects %s generation output", async (reply) => {
    const { adapter } = fixture(reply);
    expect(await adapter.generateDescriptions(generate)).toBeInstanceOf(
      InvalidGenerationResponseError
    );
  });

  test("keeps the supplied Sense even if the provider proposes another", async () => {
    const { adapter } = fixture({
      senseName: "Wrong",
      descriptions: [
        { type: "definition", text: "opis" },
        { type: "translation", text: "text" },
      ],
    });
    const result = await adapter.generateDescriptions({
      ...generate,
      senseName: "Chosen",
    });
    if (result instanceof Error) throw result;
    expect(result.senseName).toBe("Chosen");
  });

  test("sanitizes provider errors and bounds retries", async () => {
    const { adapter, bodies, errors } = fixture(
      { error: { message: "top-secret-key raw-response" } },
      503
    );
    const result = await adapter.suggestSenses({ ...base, limit: 20 });
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    expect(bodies).toHaveLength(3);
    expect(JSON.stringify({ result, errors })).not.toContain("top-secret-key");
    expect(JSON.stringify({ result, errors })).not.toContain("raw-response");
  });

  test("rejects credential-bearing HTTP errors without exposing provider output", async () => {
    const { adapter, errors, bodies } = fixture(
      { error: { message: "top-secret-key raw-response" } },
      401
    );
    const result = await adapter.generateDescriptions(generate);
    expect(result).toBeInstanceOf(DescriptionGenerationError);
    if (!(result instanceof DescriptionGenerationError)) return;
    expect(result.reason).toBe(
      "Provider authentication failed. Replace the API key."
    );
    expect(bodies).toHaveLength(1);
    expect(JSON.stringify({ result, errors })).not.toContain("top-secret-key");
    expect(JSON.stringify({ result, errors })).not.toContain("raw-response");
  });

  test("malformed replies never leak their contents through returned errors or logs", async () => {
    const { adapter, errors } = fixture("raw-response top-secret-key");
    const result = await adapter.suggestSenses({ ...base, limit: 20 });
    expect(result).toBeInstanceOf(InvalidGenerationResponseError);
    if (!(result instanceof InvalidGenerationResponseError)) return;
    expect(result.cause).toBeInstanceOf(Error);
    expect((result.cause as Error).message).toBe(
      "Provider output could not be read"
    );
    expect(JSON.stringify({ result, errors })).not.toContain("raw-response");
    expect(JSON.stringify({ result, errors })).not.toContain("top-secret-key");
  });

  test.each([
    ["openai", "https://api.openai.com/v1/chat/completions"],
    ["google", "generativelanguage.googleapis.com"],
    ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
    ["groq", "https://api.groq.com/openai/v1/chat/completions"],
  ])(
    "routes %s suggestions to its fixed Provider endpoint",
    async (providerId, endpoint) => {
      const urls: string[] = [];
      const logger: Logger = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => logger,
      };
      const adapter = new AiSdkScreenEntryGenerationAdapter({
        logger,
        fetchImplementation: async (url) => {
          urls.push(String(url));
          const text = JSON.stringify({
            senses: [{ name: "Cześć", definition: "Powitanie" }],
          });
          return Response.json(
            providerId === "google"
              ? {
                  candidates: [
                    {
                      content: { role: "model", parts: [{ text }] },
                      finishReason: "STOP",
                    },
                  ],
                }
              : {
                  id: "completion-1",
                  object: "chat.completion",
                  created: 0,
                  model: "test-model",
                  choices: [
                    {
                      index: 0,
                      finish_reason: "stop",
                      message: { role: "assistant", content: text },
                    },
                  ],
                }
          );
        },
      });
      expect(
        await adapter.suggestSenses({
          ...base,
          connection: { ...base.connection, providerId },
          limit: 20,
        })
      ).toEqual([{ name: "Cześć", definition: "Powitanie" }]);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain(endpoint);
    }
  );

  test("does not send credentials to unknown Providers", async () => {
    const { adapter, urls } = fixture({ senses: [] });
    expect(
      await adapter.suggestSenses({
        ...base,
        connection: { ...base.connection, providerId: "unknown" },
        limit: 20,
      })
    ).toBeInstanceOf(DescriptionGenerationError);
    expect(urls).toEqual([]);
  });
});
