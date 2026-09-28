import { APICallError, RetryError } from "ai";

type ProviderOperation = "description_generation" | "model_discovery";

export function getAiSdkFailureDetails(cause: unknown) {
  const apiCallError = findApiCallError(cause);
  return {
    statusCode: apiCallError?.statusCode,
    retryable: apiCallError?.isRetryable,
  };
}

export function providerFailureReason({
  operation,
  statusCode,
}: {
  operation: ProviderOperation;
  statusCode: number | undefined;
}) {
  if (statusCode === undefined)
    return "Could not reach the provider. Check the Provider Connection and network.";
  if (statusCode === 400 || statusCode === 422)
    return operation === "description_generation"
      ? "Provider rejected the request. Check the Model and Provider Connection."
      : "Provider rejected Model discovery. Check the Provider Connection endpoint.";
  if (statusCode === 401)
    return "Provider authentication failed. Replace the API key.";
  if (statusCode === 402) return "Provider account has insufficient balance.";
  if (statusCode === 403)
    return "Provider denied access. Check the API key and account permissions.";
  if (statusCode === 404)
    return operation === "description_generation"
      ? "Provider endpoint or Model was not found. Check the Provider Connection and Model."
      : "Provider does not support Model discovery at this endpoint.";
  if (statusCode === 408) return "Provider request timed out. Try again.";
  if (statusCode === 429)
    return "Provider rate limit reached. Try again later.";
  if (statusCode >= 500) return "Provider is unavailable. Try again later.";
  return "Provider request failed. Check the Provider Connection and Model.";
}

export function sanitizedProviderCause(statusCode: number | undefined) {
  const error = new Error(
    statusCode === undefined
      ? "Provider request failed"
      : `Provider returned HTTP ${statusCode}`
  );
  error.name = "ProviderDiagnosticError";
  return error;
}

function findApiCallError(
  cause: unknown,
  seen: Set<unknown> = new Set()
): APICallError | null {
  if ((typeof cause !== "object" && typeof cause !== "function") || !cause)
    return null;
  if (seen.has(cause)) return null;
  seen.add(cause);
  if (APICallError.isInstance(cause)) return cause;
  if (RetryError.isInstance(cause))
    return findApiCallError(cause.lastError, seen);
  if (cause instanceof Error && cause.cause !== undefined)
    return findApiCallError(cause.cause, seen);
  return null;
}
