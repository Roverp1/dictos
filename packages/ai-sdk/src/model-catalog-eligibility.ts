type TextGenerationCandidate = Record<string, unknown> & {
  modalities: { input: unknown[]; output: ["text"] };
};

export function isTextGenerationCandidate(
  value: unknown
): value is TextGenerationCandidate {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const model = value as Record<string, unknown>;
  const modalities = model.modalities;
  if (
    modalities === null ||
    typeof modalities !== "object" ||
    Array.isArray(modalities)
  )
    return false;
  const { input, output } = modalities as Record<string, unknown>;

  // models.dev lists embeddings as text-in/text-out; require a generation signal too.
  return (
    [undefined, "active", "alpha", "beta"].includes(
      model.status as string | undefined
    ) &&
    model.provider === undefined &&
    Array.isArray(input) &&
    input.includes("text") &&
    Array.isArray(output) &&
    output.length === 1 &&
    output[0] === "text" &&
    (model.temperature === true ||
      model.tool_call === true ||
      model.structured_output === true)
  );
}
