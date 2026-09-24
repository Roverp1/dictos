# Use AI SDK for Description Generation

Description Generation needs consistent requests, responses, validation, and errors across OpenAI-compatible providers whose structured-output behavior differs. We will use Vercel AI SDK behind a Dictos-owned `DescriptionGenerationPort`, starting with the OpenAI-compatible adapter in `json_object` mode and local schema validation. Core remains independent of the SDK, so provider-specific adapters or another library can replace it without changing domain services.

## Consequences

- Dictos does not maintain provider wire-format parsing itself.
- AI SDK errors and throwing behavior must be converted into Dictos Error values at the adapter boundary.
- One generation invocation permits at most two AI SDK retries for retryable provider failures; core and clients do not add retries.
- Clients configure the package's warning bridge so expected AI SDK compatibility warnings are sanitized into structured logs rather than written to client output.
- Provider capabilities still require explicit handling; the SDK cannot add unsupported provider features.
