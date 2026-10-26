import { parseQualifiedModelId, ValidationError } from "@dictos/core";

export function resolveCommandModel({
  override,
  configured,
}: {
  override: string | null;
  configured: string | null;
}) {
  const qualified = override ?? configured;
  if (qualified === null)
    return new ValidationError({
      reason:
        "Configure generation.default_model in config.toml or cli.toml, or supply --model <provider/model>.",
    });
  return parseQualifiedModelId(qualified);
}
