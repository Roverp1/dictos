// Run with the reviewed raw API response and its recorded SHA256; never trust a changed live feed implicitly.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import prettier from "prettier";
import * as errore from "@dictos/errore";
import { isTextGenerationCandidate } from "./src/model-catalog-eligibility.ts";

const [inputPath, expectedSha256] = process.argv.slice(2);
if (!inputPath || !/^[a-f0-9]{64}$/.test(expectedSha256 ?? "")) {
  console.error(
    "Usage: bun packages/ai-sdk/update-model-snapshot.mjs <api.json> <source-sha256>"
  );
  process.exit(1);
}

const raw = await fs
  .readFile(inputPath)
  .catch((cause) => new Error("Cannot read source", { cause }));
if (raw instanceof Error) {
  console.error(raw.message);
  process.exit(1);
}
const sourceHash = crypto.createHash("sha256").update(raw).digest("hex");
if (sourceHash !== expectedSha256) {
  console.error(
    "Source SHA256 mismatch; review the new upstream response before updating the snapshot"
  );
  process.exit(1);
}

const source = errore.try(
  () => JSON.parse(raw.toString("utf8")),
  (cause) => new Error("Source contains invalid JSON", { cause })
);
if (source instanceof Error) {
  console.error(source.message);
  process.exit(1);
}
if (source === null || typeof source !== "object" || Array.isArray(source)) {
  console.error("Source must contain Provider data");
  process.exit(1);
}
const providerIds = ["deepseek", "google", "groq", "openai", "openrouter"];
const safe = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 200 &&
  !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value);
const providers = [];
const models = [];
for (const id of providerIds) {
  const provider = source[id];
  if (provider?.id !== id || !safe(provider.name) || !provider.models) {
    console.error(`Invalid provider: ${id}`);
    process.exit(1);
  }
  providers.push({ id, name: provider.name });
  for (const [modelId, model] of Object.entries(provider.models)) {
    if (!isTextGenerationCandidate(model)) continue;
    if (
      !safe(modelId) ||
      modelId.trim() !== modelId ||
      !safe(model.name) ||
      model.id !== modelId ||
      ![...model.modalities.input, ...model.modalities.output].every(safe)
    ) {
      console.error(`Invalid eligible model in ${id}: ${modelId}`);
      process.exit(1);
    }
    const cost = model.cost;
    const price =
      cost &&
      Number.isFinite(cost.input) &&
      cost.input >= 0 &&
      Number.isFinite(cost.output) &&
      cost.output >= 0
        ? { cost: { input: cost.input, output: cost.output } }
        : {};
    models.push({
      providerId: id,
      modelId,
      name: model.name,
      textGeneration: true,
      status: model.status ?? "active",
      inputModalities: model.modalities.input,
      outputModalities: model.modalities.output,
      ...price,
    });
  }
}
models.sort((a, b) =>
  a.providerId < b.providerId
    ? -1
    : a.providerId > b.providerId
      ? 1
      : a.modelId < b.modelId
        ? -1
        : a.modelId > b.modelId
          ? 1
          : 0
);
const outputPath = new URL("./src/models-dev-snapshot.json", import.meta.url);
const output = await prettier.format(
  JSON.stringify({
    source: "bundled",
    fetchedAt: "2026-09-28",
    providers,
    models,
  }),
  {
    ...(await prettier.resolveConfig(outputPath.pathname)),
    filepath: outputPath.pathname,
  }
);
const result = await fs
  .writeFile(outputPath, output)
  .catch((cause) => new Error("Cannot write snapshot", { cause }));
if (result instanceof Error) {
  console.error(result.message);
  process.exit(1);
}
console.log(`source SHA256: ${sourceHash}`);
console.log(
  `snapshot SHA256: ${crypto.createHash("sha256").update(output).digest("hex")}`
);
console.log(`providers: ${providers.length}, models: ${models.length}`);
