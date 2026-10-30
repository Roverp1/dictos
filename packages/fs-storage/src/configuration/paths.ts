import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as errore from "@dictos/errore";
import type { ConfigurationError, ConfigurationScope } from "@dictos/config";
import { configurationFailure } from "./errors";

export type NativeConfigurationPaths = {
  directory: string;
  schemaUris: Readonly<Record<ConfigurationScope, string>>;
};

export function resolveNativeConfigurationPaths(input: {
  platform: string;
  homeDirectory: string;
  environment: Readonly<Record<string, string | undefined>>;
}): NativeConfigurationPaths | ConfigurationError {
  const paths = input.platform === "win32" ? path.win32 : path.posix;
  if (!paths.isAbsolute(input.homeDirectory)) {
    return configurationFailure({
      kind: "initialize",
      source: "homeDirectory",
      message: "Expected an absolute home directory.",
    });
  }
  const directory = (() => {
    if (input.platform === "darwin")
      return paths.join(
        input.homeDirectory,
        "Library",
        "Preferences",
        "dictos"
      );
    if (input.platform === "win32") {
      const appData = input.environment.APPDATA;
      const base =
        appData && paths.isAbsolute(appData)
          ? appData
          : paths.join(input.homeDirectory, "AppData", "Roaming");
      return paths.join(base, "dictos", "config");
    }
    const xdg = input.environment.XDG_CONFIG_HOME;
    const base =
      xdg && paths.isAbsolute(xdg)
        ? xdg
        : paths.join(input.homeDirectory, ".config");
    return paths.join(base, "dictos");
  })();
  const schemaUris = {} as Record<ConfigurationScope, string>;
  for (const scope of ["global", "cli", "overlay"] as const) {
    const asset = `@dictos/config/schemas/${scope === "global" ? "config" : scope}.schema.json`;
    const uri = errore.try(
      () => {
        const resolved = import.meta.resolve(asset);
        const location = url.fileURLToPath(resolved);
        fs.accessSync(location, fs.constants.R_OK);
        return fs.statSync(location).isFile()
          ? url.pathToFileURL(location).href
          : null;
      },
      (cause) =>
        configurationFailure({
          kind: "initialize",
          source: asset,
          message: "Could not locate the bundled configuration schema.",
          cause,
        })
    );
    if (uri instanceof Error) return uri;
    if (uri === null)
      return configurationFailure({
        kind: "initialize",
        source: asset,
        message: "Expected a bundled schema file.",
      });
    schemaUris[scope] = uri;
  }
  return { directory, schemaUris };
}
