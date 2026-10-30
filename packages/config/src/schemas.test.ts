import { expect, test } from "bun:test";
import Ajv from "ajv-draft-04";
import { configurationSchemas, describeConfiguration } from "./index";

test("exported Draft 4 file schemas agree with runtime validation on optional and strict contributions", async () => {
  const cases = {
    global: {
      file: "config.schema.json",
      valid: [
        {},
        { generation: {}, logging: {} },
        {
          generation: { default_model: "new-provider/team/model" },
          logging: { level: "fatal" },
        },
      ],
      invalid: [
        { generation: { default_model: "" } },
        { generation: { default_model: "a/" } },
        { generation: { default_model: "/b" } },
        { generation: { default_model: " a/b" } },
        { generation: { default_model: null } },
        { logging: { level: "secret" } },
        { logging: { level: 1 } },
        { logging: { extra: true } },
        { ocr: {} },
        { generation: { extra: true } },
      ],
    },
    cli: {
      file: "cli.schema.json",
      valid: [
        {},
        { overrides: {} },
        { overrides: { generation: {}, logging: {} } },
        {
          overrides: {
            generation: { default_model: "custom/model" },
            logging: { level: "trace" },
          },
        },
      ],
      invalid: [
        { generation: {} },
        { overrides: { ocr: {} } },
        { overrides: { logging: { level: false } } },
        { overrides: { generation: { typo: true } } },
        { overrides: null },
      ],
    },
    overlay: {
      file: "overlay.schema.json",
      valid: [
        {},
        { overrides: { generation: {} }, ocr: {} },
        { ocr: { languages: ["eng", "script/Latin"] } },
        { overrides: { generation: { default_model: "unknown/a/b" } } },
      ],
      invalid: [
        { overrides: { logging: {} } },
        { logging: {} },
        { ocr: { languages: [] } },
        { ocr: { languages: ["eng+pol"] } },
        { ocr: { languages: ["script//Latin"] } },
        { ocr: { languages: ["en g"] } },
        { ocr: { languages: "eng" } },
        { ocr: { languages: [7] } },
        { ocr: { extra: true } },
      ],
    },
  };
  for (const scope of ["global", "cli", "overlay"] as const) {
    const fixture = cases[scope];
    const schema = await Bun.file(
      new URL(import.meta.resolve(`@dictos/config/schemas/${fixture.file}`))
    ).json();
    expect(schema.$schema).toBe("http://json-schema.org/draft-04/schema#");
    const validate = new Ajv({ strict: false }).compile(schema);
    for (const value of fixture.valid) {
      expect(configurationSchemas[scope].safeParse(value).success).toBe(true);
      expect(validate(value)).toBe(true);
    }
    for (const value of fixture.invalid) {
      expect(configurationSchemas[scope].safeParse(value).success).toBe(false);
      expect(validate(value)).toBe(false);
    }
    const empty = configurationSchemas[scope].safeParse({});
    expect(empty.success && empty.data).toEqual({});
  }
});

test("editor annotations and starter metadata agree while omitted settings stay omitted", async () => {
  for (const scope of ["global", "cli", "overlay"] as const) {
    const filename = scope === "global" ? "config" : scope;
    const schema = await Bun.file(
      new URL(
        import.meta.resolve(`@dictos/config/schemas/${filename}.schema.json`)
      )
    ).json();
    for (const setting of describeConfiguration({ scope })) {
      const leaf = setting.keyPath.reduce(
        (node, key) => node.properties[key],
        schema
      );
      expect(leaf.description).toBe(setting.description);
      expect(leaf.examples).toEqual([setting.example]);
      if (setting.id === "defaultModel")
        expect(Object.hasOwn(leaf, "default")).toBe(false);
      else expect(leaf.default).toEqual(setting.defaultValue);
      const document = setting.keyPath.reduceRight<Record<string, unknown>>(
        (child, key) => ({ [key]: child }),
        setting.example as Record<string, unknown>
      );
      const parsed = configurationSchemas[scope].safeParse(document);
      expect(parsed.success && parsed.data).toEqual(document);
    }
  }
});
