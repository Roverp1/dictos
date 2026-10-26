import { expect, test } from "bun:test";
import {
  ConfigurationError,
  configurationScopes,
  describeConfiguration,
  resolveConfiguration,
} from "./index";

test("unknown and prohibited keys report each complete path and the contributing source", () => {
  const cases = [
    {
      documents: {
        global: {
          source: "config.toml",
          value: {
            loging: { level: "VALUE_MUST_NOT_LEAK" },
            typo: "VALUE_MUST_NOT_LEAK",
          },
        },
        cli: {
          source: "cli.toml",
          value: { overrides: { logging: { level: "debug" } } },
        },
      },
      source: "config.toml",
      paths: [["loging"], ["typo"]],
    },
    {
      documents: {
        cli: {
          source: "cli.toml",
          value: {
            overrides: { generation: { default_modle: "VALUE_MUST_NOT_LEAK" } },
          },
        },
        overlay: {
          source: "overlay.toml",
          value: {
            overrides: { generation: { default_model: "custom/model" } },
          },
        },
      },
      source: "cli.toml",
      paths: [["overrides", "generation", "default_modle"]],
    },
    {
      documents: {
        overlay: {
          source: "overlay.toml",
          value: { overrides: { logging: { level: "VALUE_MUST_NOT_LEAK" } } },
        },
      },
      source: "overlay.toml",
      paths: [["overrides", "logging"]],
    },
  ];
  for (const fixture of cases) {
    const result = resolveConfiguration({
      client: "overlay",
      documents: fixture.documents,
      environment: { ocrLanguages: null },
    });
    expect(result).toBeInstanceOf(ConfigurationError);
    if (!(result instanceof ConfigurationError))
      throw new Error("Expected configuration error");
    expect(result.issues).toEqual(
      fixture.paths.map((keyPath) => ({
        kind: "validate",
        source: fixture.source,
        keyPath,
        line: null,
        column: null,
        message: "Unknown or prohibited configuration key.",
      }))
    );
    expect(JSON.stringify(result.issues)).not.toContain("VALUE_MUST_NOT_LEAK");
  }
});

test("unknown key diagnostics escape terminal controls without exposing supplied values", () => {
  const result = resolveConfiguration({
    client: "cli",
    documents: {
      global: {
        source: "config\n.toml",
        value: {
          logging: {
            ["bad\u001b[31m\n\r\t\u007f\u009b\u202e\u2028\u{e0001}"]:
              "VALUE_MUST_NOT_LEAK",
          },
        },
      },
    },
    environment: { ocrLanguages: null },
  });
  if (!(result instanceof ConfigurationError))
    throw new Error("Expected configuration error");
  expect(result.issues).toEqual([
    {
      kind: "validate",
      source: "config\\u{a}.toml",
      keyPath: [
        "logging",
        "bad\\u{1b}[31m\\u{a}\\u{d}\\u{9}\\u{7f}\\u{9b}\\u{202e}\\u{2028}\\u{e0001}",
      ],
      line: null,
      column: null,
      message: "Unknown or prohibited configuration key.",
    },
  ]);
  for (const issue of result.issues) {
    expect(
      [issue.source, ...issue.keyPath, issue.message].join(" ")
    ).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
  }
  expect(JSON.stringify(result.issues)).not.toContain("VALUE_MUST_NOT_LEAK");
});

test("empty CLI contributions resolve absent Model and info defaults with origins", () => {
  const result = resolveConfiguration({
    client: "cli",
    documents: {},
    environment: { ocrLanguages: null },
  });
  if (result instanceof Error) throw result;
  expect(result).toEqual({
    version: 1,
    client: "cli",
    settings: { defaultModel: null, logLevel: "info", ocrLanguages: null },
    origins: {
      defaultModel: { kind: "default", source: null, keyPath: [] },
      logLevel: { kind: "default", source: null, keyPath: [] },
    },
  });
});

test("resolved values, provenance, scope tables, and metadata cannot be mutated by callers", () => {
  const languages = ["pol"];
  const result = resolveConfiguration({
    client: "overlay",
    documents: {
      overlay: { source: "overlay.toml", value: { ocr: { languages } } },
    },
    environment: { ocrLanguages: null },
  });
  if (result instanceof Error) throw result;
  languages.push("eng");
  expect(result.settings.ocrLanguages).toEqual(["pol"]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.origins)).toBe(true);
  expect(Object.isFrozen(result.settings.ocrLanguages)).toBe(true);
  expect(Object.isFrozen(result.origins.ocrLanguages)).toBe(true);
  expect(Object.isFrozen(configurationScopes({ client: "overlay" }))).toBe(
    true
  );
  const description = describeConfiguration({ scope: "overlay" });
  expect(Object.isFrozen(description[1]?.defaultValue)).toBe(true);
});

test("Overlay environment languages must be a nonempty ordered identifier list", () => {
  for (const languages of [
    [],
    [""],
    ["eng+pol"],
    [" eng"],
    ["script//Latin"],
    ["eng/"],
    ["en g"],
  ]) {
    const result = resolveConfiguration({
      client: "overlay",
      documents: {},
      environment: { ocrLanguages: languages },
    });
    expect(result).toBeInstanceOf(ConfigurationError);
    if (!(result instanceof ConfigurationError))
      throw new Error("Expected configuration error");
    expect(result.issues[0]?.source).toBe("DICTOS_OCR_LANG");
    expect(result.issues.length).toBeGreaterThan(0);
  }
});

test("every loaded contribution is validated before overrides and unrelated scopes are ignored", () => {
  const documents = {
    global: { source: "config.toml", value: { logging: { level: "SECRET" } } },
    cli: {
      source: "cli.toml",
      value: { overrides: { logging: { level: "debug" } } },
    },
  };
  for (const client of ["cli", "overlay"] as const) {
    const result = resolveConfiguration({
      client,
      documents,
      environment: { ocrLanguages: null },
    });
    expect(result).toBeInstanceOf(ConfigurationError);
    if (!(result instanceof ConfigurationError))
      throw new Error("Expected configuration error");
    expect(result.issues).toEqual([
      {
        kind: "validate",
        source: "config.toml",
        keyPath: ["logging", "level"],
        line: null,
        column: null,
        message: "Expected trace, debug, info, warn, error, or fatal.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  }
  const ignored = resolveConfiguration({
    client: "cli",
    documents: { overlay: { source: "overlay.toml", value: { secret: true } } },
    environment: { ocrLanguages: [] },
  });
  if (ignored instanceof Error) throw ignored;
  expect(ignored.settings.ocrLanguages).toBeNull();
  expect(configurationScopes({ client: "cli" })).toEqual(["global", "cli"]);
  expect(configurationScopes({ client: "overlay" })).toEqual([
    "global",
    "cli",
    "overlay",
  ]);
  expect(
    describeConfiguration({ scope: "overlay" }).map((setting) => [
      setting.id,
      setting.keyPath,
    ])
  ).toEqual([
    ["defaultModel", ["overrides", "generation", "default_model"]],
    ["ocrLanguages", ["ocr", "languages"]],
  ]);
  const invalidCli = resolveConfiguration({
    client: "overlay",
    documents: {
      cli: {
        source: "cli.toml",
        value: { overrides: { generation: { default_model: "" } } },
      },
      overlay: {
        source: "overlay.toml",
        value: { overrides: { generation: { default_model: "custom/model" } } },
      },
    },
    environment: { ocrLanguages: null },
  });
  expect(invalidCli).toBeInstanceOf(ConfigurationError);
  if (!(invalidCli instanceof ConfigurationError))
    throw new Error("Expected configuration error");
  expect(invalidCli.issues[0]?.source).toBe("cli.toml");
});

test("Overlay inherits CLI logging and Model, replaces languages, and restores inheritance after deletion", () => {
  const documents = {
    global: {
      source: "config.toml",
      value: {
        generation: { default_model: "custom/team/model" },
        logging: { level: "warn" },
      },
    },
    cli: {
      source: "cli.toml",
      value: {
        overrides: {
          generation: { default_model: "other/B" },
          logging: { level: "debug" },
        },
      },
    },
    overlay: {
      source: "overlay.toml",
      value: {
        overrides: { generation: { default_model: "third/C" } },
        ocr: { languages: ["pol"] },
      },
    },
  };
  const result = resolveConfiguration({
    client: "overlay",
    documents,
    environment: { ocrLanguages: ["script/Latin", "eng"] },
  });
  if (result instanceof Error) throw result;
  expect(result.settings).toEqual({
    defaultModel: "third/C",
    logLevel: "debug",
    ocrLanguages: ["script/Latin", "eng"],
  });
  expect(result.origins).toEqual({
    defaultModel: {
      kind: "overlay",
      source: "overlay.toml",
      keyPath: ["overrides", "generation", "default_model"],
    },
    logLevel: {
      kind: "cli",
      source: "cli.toml",
      keyPath: ["overrides", "logging", "level"],
    },
    ocrLanguages: {
      kind: "environment",
      source: "DICTOS_OCR_LANG",
      keyPath: [],
    },
  });
  const inherited = resolveConfiguration({
    client: "overlay",
    documents: { ...documents, overlay: { source: "overlay.toml", value: {} } },
    environment: { ocrLanguages: null },
  });
  if (inherited instanceof Error) throw inherited;
  expect(inherited.settings).toEqual({
    defaultModel: "other/B",
    logLevel: "debug",
    ocrLanguages: ["eng"],
  });
});
