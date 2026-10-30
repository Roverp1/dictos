import { expect, test } from "bun:test";
import {
  ConfigurationError,
  resolveConfiguration,
  validateConfigurationSnapshot,
} from "./index";

test("complete version-1 snapshots roundtrip without sharing mutable values", () => {
  for (const client of ["cli", "overlay"] as const) {
    const resolved = resolveConfiguration({
      client,
      documents: {},
      environment: { ocrLanguages: null },
    });
    if (resolved instanceof Error) throw resolved;
    const value = JSON.parse(JSON.stringify(resolved));
    const result = validateConfigurationSnapshot({ value });
    if (result instanceof Error) throw result;
    expect(result).toEqual(resolved);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.settings)).toBe(true);
    expect(Object.isFrozen(result.origins.defaultModel?.keyPath)).toBe(true);
    value.settings.logLevel = "fatal";
    expect(result.settings.logLevel).toBe("info");
  }
});

test("malformed snapshots never gain missing defaults and reject unrelated or unknown nested fields", () => {
  const resolved = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (resolved instanceof Error) throw resolved;
  const incomplete = [
    undefined,
    null,
    {},
    { ...resolved, version: 2 },
    { ...resolved, client: "web" },
  ];
  for (const key of ["version", "client", "settings", "origins"]) {
    const value = { ...resolved } as Record<string, unknown>;
    delete value[key];
    incomplete.push(value);
  }
  for (const key of ["defaultModel", "logLevel", "ocrLanguages"]) {
    const settings = { ...resolved.settings } as Record<string, unknown>;
    delete settings[key];
    incomplete.push({ ...resolved, settings });
    const origins = { ...resolved.origins } as Record<string, unknown>;
    delete origins[key];
    incomplete.push({ ...resolved, origins });
  }
  incomplete.push(
    { ...resolved, selectedModel: "secret/selection" },
    { ...resolved, deviceId: "private-device" },
    { ...resolved, credentials: { apiKey: "SECRET" } },
    {
      ...resolved,
      settings: { ...resolved.settings, selectedModel: "secret/selection" },
    },
    { ...resolved, settings: { ...resolved.settings, ocrLanguages: [] } },
    { ...resolved, origins: { ...resolved.origins, other: {} } },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        logLevel: { ...resolved.origins.logLevel, extra: "SECRET" },
      },
    }
  );
  for (const value of incomplete) {
    const result = validateConfigurationSnapshot({ value });
    expect(result).toBeInstanceOf(ConfigurationError);
    if (!(result instanceof ConfigurationError))
      throw new Error("Expected snapshot error");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.issues)).not.toContain("SECRET");
  }
  const unsupported = validateConfigurationSnapshot({
    value: { ...resolved, version: 2 },
  });
  if (!(unsupported instanceof ConfigurationError))
    throw new Error("Expected version error");
  expect(unsupported.issues[0]?.message).toBe(
    "Expected snapshot transport version 1."
  );
});

test("snapshot validation rejects contradictory clients, values, and origins without defaults", () => {
  const resolved = resolveConfiguration({
    client: "overlay",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (resolved instanceof Error) throw resolved;
  const invalid = [
    { ...resolved, client: "cli" },
    { ...resolved, settings: { ...resolved.settings, ocrLanguages: null } },
    {
      ...resolved,
      settings: { ...resolved.settings, defaultModel: "custom/model" },
    },
    { ...resolved, settings: { ...resolved.settings, logLevel: "fatal" } },
    { ...resolved, settings: { ...resolved.settings, ocrLanguages: ["pol"] } },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        logLevel: {
          kind: "overlay",
          source: "overlay.toml",
          keyPath: ["overrides", "logging", "level"],
        },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        defaultModel: {
          kind: "global",
          source: "config.toml",
          keyPath: ["generation", "default_model"],
        },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        logLevel: {
          kind: "cli",
          source: null,
          keyPath: ["overrides", "logging", "level"],
        },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        logLevel: {
          kind: "cli",
          source: "cli.toml",
          keyPath: ["logging", "level"],
        },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        logLevel: {
          kind: "environment",
          source: "DICTOS_OCR_LANG",
          keyPath: [],
        },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        ocrLanguages: { kind: "environment", source: "OTHER", keyPath: [] },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        defaultModel: { kind: "default", source: "config.toml", keyPath: [] },
      },
    },
    {
      ...resolved,
      origins: {
        ...resolved.origins,
        defaultModel: {
          kind: "default",
          source: null,
          keyPath: ["generation"],
        },
      },
    },
  ];
  for (const value of invalid) {
    const result = validateConfigurationSnapshot({ value });
    expect(result).toBeInstanceOf(ConfigurationError);
    if (!(result instanceof ConfigurationError))
      throw new Error("Expected snapshot error");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]?.kind).toBe("snapshot");
  }
});
