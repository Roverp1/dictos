import { ValidationError } from "../errors";

export type ProviderId = string;
export type ModelId = string;
export type QualifiedModelId = string;

export interface ProviderConnection {
  providerId: ProviderId;
}

export interface ProviderConnectionWithCredential extends ProviderConnection {
  apiKey: string;
}

export interface SelectedModel {
  providerId: ProviderId;
  modelId: ModelId;
}

export function parseQualifiedModelId(
  value: QualifiedModelId
): SelectedModel | ValidationError {
  const separator = value.indexOf("/");
  const providerId = value.slice(0, separator);
  const modelId = value.slice(separator + 1);
  if (
    separator <= 0 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(providerId) ||
    modelId.trim() !== modelId ||
    !modelId ||
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(modelId)
  )
    return new ValidationError({
      reason: "Use a qualified Model ID such as openai/gpt-4o.",
    });

  return { providerId, modelId };
}
