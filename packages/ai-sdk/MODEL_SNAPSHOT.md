# Bundled Model Catalog Snapshot

- Source: https://models.dev/api.json (official public API; default model types)
- Retrieved: 2026-09-28 (UTC)
- Source SHA256 (raw response, 5,233,702 bytes): `745aa9c07effa36c34f4cee5eda9f2acd49b8fa70576234b4d9e7601602f2337`
- Snapshot SHA256 (`src/models-dev-snapshot.json`): `f79bb21143f8f6cfdee17079e88cd9f7e33f997e5bc6a9d4ee4069dee86ef323`
- License and full permission notice: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) (MIT)

The asset includes Models from `openai`, `google`, `openrouter`, `deepseek`, and `groq` only when upstream reports text input, exactly `["text"]` output, and at least one of `temperature`, `tool_call`, or `structured_output` as `true`. Deprecated Models and model-specific provider overrides are excluded. Every included Model has `textGeneration: true`; this marker is derived only after those checks, never trusted from upstream. The asset retains provider display names, exact provider-specific Model IDs (including `/`), model names, status (`active` when upstream omits it), modalities, and input/output cost per million tokens when both are available. It drops execution metadata such as upstream API URLs and npm packages. Catalog membership does not guarantee account access or structured-output behavior.

To reproduce from the reviewed response (use a trusted saved copy with the source hash above):

```sh
curl --fail --location https://models.dev/api.json --output /tmp/models-dev-api.json
sha256sum /tmp/models-dev-api.json
bun packages/ai-sdk/update-model-snapshot.mjs /tmp/models-dev-api.json 745aa9c07effa36c34f4cee5eda9f2acd49b8fa70576234b4d9e7601602f2337
sha256sum packages/ai-sdk/src/models-dev-snapshot.json
```

If the live response hash differs, do not run the updater with a new hash blindly: review the changed models, status, modalities, license, and provider routing assumptions, then update the retrieval date in this document and the extractor and both hashes here. The extractor sorts by provider and exact Model ID, making output independent of upstream JSON key order.
