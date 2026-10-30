import os from "node:os";
import * as errore from "@dictos/errore";
import {
  ConfigurationError,
  validateConfigurationSnapshot,
  type ConfigurationClient,
} from "@dictos/config";
import {
  initializeAndLoadConfiguration,
  resolveNativeConfigurationPaths,
} from "@dictos/fs-storage/configuration";

export function snapshotError(message: string, cause?: unknown) {
  return new ConfigurationError({
    issues: [
      {
        kind: "snapshot",
        source: "DICTOS_OVERLAY_CONFIG_SNAPSHOT",
        keyPath: [],
        line: null,
        column: null,
        message,
      },
    ],
    cause,
  });
}

export async function loadNativeConfiguration(client: ConfigurationClient) {
  const paths = resolveNativeConfigurationPaths({
    platform: process.platform,
    homeDirectory: os.homedir(),
    environment: process.env,
  });
  if (paths instanceof Error) return paths;
  return initializeAndLoadConfiguration({
    client,
    paths,
    ocrLanguageEnvironment:
      client === "overlay" ? (process.env.DICTOS_OCR_LANG ?? null) : null,
  });
}

export async function loadCliConfiguration() {
  const encoded = process.env.DICTOS_OVERLAY_CONFIG_SNAPSHOT;
  if (encoded === undefined) return loadNativeConfiguration("cli");
  if (Buffer.byteLength(encoded, "utf8") > 16 * 1024)
    return snapshotError(
      "Startup snapshot exceeds the 16 KiB limit; reopen the Overlay."
    );
  const parsed = errore.try(
    () => ({ value: JSON.parse(encoded) as unknown }),
    (cause) =>
      snapshotError(
        "Startup snapshot must contain valid JSON; reopen the Overlay.",
        cause
      )
  );
  if (parsed instanceof Error) return parsed;
  const snapshot = validateConfigurationSnapshot(parsed);
  if (snapshot instanceof Error) return snapshot;
  if (snapshot.client !== "overlay")
    return snapshotError(
      "Startup snapshot must belong to the overlay client; reopen the Overlay."
    );
  return snapshot;
}
