import { validateConfigurationSnapshot } from "@dictos/config";
import * as errore from "@dictos/errore";
import url from "node:url";

export class PrepareLaunchError extends errore.createTaggedError({
  name: "PrepareLaunchError",
  message: "$reason",
}) {}

const failure = () =>
  new PrepareLaunchError({
    reason: "Overlay configuration bootstrap returned no usable result.",
  });

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validIssue(value: unknown) {
  return (
    record(value) &&
    ["initialize", "read", "parse", "validate", "snapshot"].includes(
      String(value.kind)
    ) &&
    typeof value.source === "string" &&
    value.source.length > 0 &&
    Array.isArray(value.keyPath) &&
    value.keyPath.every((key: unknown) => typeof key === "string") &&
    [value.line, value.column].every(
      (position) =>
        position === null ||
        (Number.isInteger(position) && Number(position) > 0)
    ) &&
    typeof value.message === "string" &&
    value.message.trim().length > 0
  );
}

export function decodeBootstrapResponse({
  stdout,
  exitCode,
}: {
  stdout: string;
  exitCode: number;
}): string | PrepareLaunchError {
  if (Buffer.byteLength(stdout) > 1024 * 1024) return failure();
  if (!stdout.endsWith("\n") || stdout.slice(0, -1).includes("\n"))
    return failure();
  const parsed = errore.try(
    () => ({ value: JSON.parse(stdout) as unknown }),
    (cause) =>
      new PrepareLaunchError({
        reason: "Overlay configuration bootstrap returned no usable result.",
        cause,
      })
  );
  if (parsed instanceof Error) return parsed;
  const response = parsed.value;
  if (
    record(response) &&
    response.ok === false &&
    !("data" in response) &&
    exitCode === 5 &&
    record(response.error) &&
    response.error.code === "CONFIGURATION_ERROR" &&
    typeof response.error.message === "string" &&
    response.error.message.trim().length > 0 &&
    Array.isArray(response.error.issues) &&
    response.error.issues.length > 0 &&
    response.error.issues.every(validIssue)
  ) {
    return new PrepareLaunchError({ reason: response.error.message });
  }
  if (
    !record(response) ||
    response.ok !== true ||
    exitCode !== 0 ||
    !("data" in response) ||
    "error" in response
  )
    return failure();
  const snapshot = validateConfigurationSnapshot({ value: response.data });
  if (snapshot instanceof Error) return failure();
  if (snapshot.client !== "overlay") return failure();
  const encoded = JSON.stringify(snapshot);
  if (Buffer.byteLength(encoded) > 16 * 1024) return failure();
  return encoded;
}

export async function prepareLaunch(): Promise<string | PrepareLaunchError> {
  const child = errore.try(
    () =>
      Bun.spawn(
        [
          process.execPath,
          url.fileURLToPath(new URL("../../cli/src/index.ts", import.meta.url)),
          "overlay",
          "bootstrap",
          "--json",
        ],
        { stdin: "ignore", stdout: "pipe", stderr: "ignore" }
      ),
    (cause) =>
      new PrepareLaunchError({
        reason: "Could not start Overlay configuration bootstrap.",
        cause,
      })
  );
  if (child instanceof Error) return child;
  const reader = child.stdout.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const chunk = await reader.read().catch(
      (cause) =>
        new PrepareLaunchError({
          reason: "Could not read Overlay configuration bootstrap.",
          cause,
        })
    );
    if (chunk instanceof Error) {
      child.kill();
      await child.exited;
      return chunk;
    }
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 1024 * 1024) {
      child.kill();
      await child.exited;
      return failure();
    }
    chunks.push(chunk.value);
  }
  const exitCode = await child.exited;
  const stdout = errore.try(
    () =>
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    (cause) =>
      new PrepareLaunchError({
        reason: "Invalid Overlay configuration bootstrap encoding.",
        cause,
      })
  );
  if (stdout instanceof Error) return stdout;
  return decodeBootstrapResponse({ stdout, exitCode });
}

if (import.meta.main) {
  const result = await prepareLaunch();
  if (result instanceof Error) {
    console.error(result.message);
    process.exitCode = 1;
  } else {
    process.stdout.write(result + "\n");
  }
}
