import fs from "node:fs/promises";
import nativeFs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
import * as errore from "@dictos/errore";
import * as toml from "smol-toml";
import {
  configurationScopes,
  resolveConfiguration,
  type ConfigurationClient,
  type ConfigurationDocument,
  type ConfigurationError,
  type ConfigurationScope,
  type ConfigurationSnapshot,
} from "@dictos/config";
import { configurationFailure, hasCode } from "./errors";
import type { NativeConfigurationPaths } from "./paths";
import { renderStarter } from "./starter";

const filenames: Record<ConfigurationScope, string> = {
  global: "config.toml",
  cli: "cli.toml",
  overlay: "overlay.toml",
};

async function ensureStarter(input: {
  source: string;
  scope: ConfigurationScope;
  schemaUri: string;
}) {
  const existing = await fs.lstat(input.source).catch((cause) =>
    hasCode(cause, "ENOENT")
      ? null
      : configurationFailure({
          kind: "initialize",
          source: input.source,
          message: "Could not inspect the configuration file.",
          cause,
        })
  );
  if (existing instanceof Error) return existing;
  if (existing !== null) return null;
  const text = renderStarter(input);
  if (text instanceof Error) return text;
  const directory = await fs
    .mkdir(path.dirname(input.source), { recursive: true, mode: 0o700 })
    .catch((cause) =>
      configurationFailure({
        kind: "initialize",
        source: input.source,
        message: "Could not create the configuration directory.",
        cause,
      })
    );
  if (directory instanceof Error) return directory;
  const temporary = path.join(
    path.dirname(input.source),
    `.${path.basename(input.source)}.${crypto.randomUUID()}.tmp`
  );
  const handle = await fs.open(temporary, "wx", 0o600).catch((cause) =>
    configurationFailure({
      kind: "initialize",
      source: input.source,
      message: "Could not create a temporary configuration file.",
      cause,
    })
  );
  if (handle instanceof Error) return handle;
  const write = await handle.writeFile(text, "utf8").catch((cause) =>
    configurationFailure({
      kind: "initialize",
      source: input.source,
      message: "Could not write the configuration starter.",
      cause,
    })
  );
  const close = await handle.close().catch((cause) =>
    configurationFailure({
      kind: "initialize",
      source: input.source,
      message: "Could not close the configuration starter.",
      cause,
    })
  );
  const publish =
    write instanceof Error
      ? write
      : close instanceof Error
        ? close
        : await fs.link(temporary, input.source).catch((cause) =>
            hasCode(cause, "EEXIST")
              ? null
              : configurationFailure({
                  kind: "initialize",
                  source: input.source,
                  message: "Could not publish the configuration starter.",
                  cause,
                })
          );
  const cleanup = await fs.unlink(temporary).catch((cause) =>
    configurationFailure({
      kind: "initialize",
      source: input.source,
      message: "Could not remove the temporary configuration file.",
      cause,
    })
  );
  if (cleanup instanceof Error) return cleanup;
  if (publish instanceof Error) return publish;
  return null;
}

const maximumFileBytes = 256 * 1024;

async function readBoundedBytes(source: string) {
  // Nonblocking open lets us reject FIFOs and devices without waiting for a writer.
  const handle = await fs
    .open(source, nativeFs.constants.O_RDONLY | nativeFs.constants.O_NONBLOCK)
    .catch((cause) =>
      configurationFailure({
        kind: "read",
        source,
        message: "Could not read the configuration file.",
        cause,
      })
    );
  if (handle instanceof Error) return handle;
  const result = await (async () => {
    const stats = await handle.stat().catch((cause) =>
      configurationFailure({
        kind: "read",
        source,
        message: "Could not inspect the configuration file.",
        cause,
      })
    );
    if (stats instanceof Error) return stats;
    if (!stats.isFile())
      return configurationFailure({
        kind: "read",
        source,
        message: "Expected a regular configuration file.",
      });
    if (stats.size > maximumFileBytes)
      return configurationFailure({
        kind: "read",
        source,
        message: "Configuration file exceeds the 256 KiB limit.",
      });
    const bytes = Buffer.alloc(maximumFileBytes + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = await handle
        .read(bytes, offset, bytes.length - offset, null)
        .catch((cause) =>
          configurationFailure({
            kind: "read",
            source,
            message: "Could not read the configuration file.",
            cause,
          })
        );
      if (chunk instanceof Error) return chunk;
      if (chunk.bytesRead === 0) break;
      offset += chunk.bytesRead;
    }
    if (offset > maximumFileBytes)
      return configurationFailure({
        kind: "read",
        source,
        message: "Configuration file exceeds the 256 KiB limit.",
      });
    return bytes.subarray(0, offset);
  })();
  const close = await handle.close().catch((cause) =>
    configurationFailure({
      kind: "read",
      source,
      message: "Could not close the configuration file.",
      cause,
    })
  );
  if (close instanceof Error) return close;
  return result;
}

async function readDocument(source: string) {
  const bytes = await readBoundedBytes(source);
  if (bytes instanceof Error) return bytes;
  const text = errore.try(
    () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    (cause) =>
      configurationFailure({
        kind: "read",
        source,
        message: "Configuration file must contain valid UTF-8.",
        cause,
      })
  );
  if (text instanceof Error) return text;
  return errore.try(
    () => ({ source, value: toml.parse(text) }),
    (cause) =>
      configurationFailure({
        kind: "parse",
        source,
        message: "Invalid TOML syntax.",
        cause,
        line:
          cause instanceof toml.TomlError &&
          Number.isSafeInteger(cause.line) &&
          cause.line > 0
            ? cause.line
            : null,
        column:
          cause instanceof toml.TomlError &&
          Number.isSafeInteger(cause.column) &&
          cause.column > 0
            ? cause.column
            : null,
      })
  );
}

export async function initializeAndLoadConfiguration(input: {
  client: ConfigurationClient;
  paths: NativeConfigurationPaths;
  ocrLanguageEnvironment: string | null;
}): Promise<ConfigurationSnapshot | ConfigurationError> {
  const scopes = configurationScopes({ client: input.client });
  for (const scope of scopes) {
    const source = input.paths.schemaUris[scope];
    const location = errore.try(
      () => url.fileURLToPath(source),
      (cause) =>
        configurationFailure({
          kind: "initialize",
          source,
          message: "Expected a local configuration schema file URI.",
          cause,
        })
    );
    if (location instanceof Error) return location;
    const artifact = await fs.stat(location).catch((cause) =>
      configurationFailure({
        kind: "initialize",
        source,
        message: "Could not access the bundled configuration schema.",
        cause,
      })
    );
    if (artifact instanceof Error) return artifact;
    if (!artifact.isFile())
      return configurationFailure({
        kind: "initialize",
        source,
        message: "Expected a bundled schema file.",
      });
    const readable = await fs
      .access(location, nativeFs.constants.R_OK)
      .catch((cause) =>
        configurationFailure({
          kind: "initialize",
          source,
          message: "Could not read the bundled configuration schema.",
          cause,
        })
      );
    if (readable instanceof Error) return readable;
  }
  const documents: Partial<Record<ConfigurationScope, ConfigurationDocument>> =
    {};
  for (const scope of scopes) {
    const source = path.join(input.paths.directory, filenames[scope]);
    const initialized = await ensureStarter({
      source,
      scope,
      schemaUri: input.paths.schemaUris[scope],
    });
    if (initialized instanceof Error) return initialized;
    const document = await readDocument(source);
    if (document instanceof Error) return document;
    documents[scope] = document;
  }
  const ocrLanguages =
    input.client === "overlay" && input.ocrLanguageEnvironment
      ? input.ocrLanguageEnvironment.split("+")
      : null;
  return resolveConfiguration({
    client: input.client,
    documents,
    environment: { ocrLanguages },
  });
}
