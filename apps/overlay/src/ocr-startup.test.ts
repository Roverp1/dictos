import { expect, test } from "bun:test";
import { decodeOcrStartupRecord, renderOcrStartupFailure } from "./ocr-startup";

test("startup diagnostics name only validated requested languages", () => {
  const record = decodeOcrStartupRecord({
    input:
      '{"ready":false,"error":{"code":"OCR_LANGUAGE_UNAVAILABLE","missingLanguages":["pol"]}}\n',
    requestedLanguages: ["eng", "pol"],
  });
  expect(record instanceof Error).toBe(false);
  if (record instanceof Error) return;
  expect(
    renderOcrStartupFailure({ record, requestedLanguages: ["eng", "pol"] })
  ).toContain("pol");
  expect(
    renderOcrStartupFailure({ record, requestedLanguages: ["eng", "pol"] })
  ).toContain("Tesseract");
});

test("untrusted startup records cannot inject terminal diagnostics", () => {
  for (const input of [
    "",
    '{"ready":true,"initMs":0}',
    '{"ready":true,"initMs":-1}\n',
    '{"ready":true,"initMs":1,"message":"SECRET"}\n',
    '{"ready":false,"error":{"code":"OCR_LANGUAGE_UNAVAILABLE","missingLanguages":["SECRET"]}}\n',
    '{"ready":false,"error":{"code":"OCR_STARTUP_FAILED","message":"SECRET"}}\n',
    '{"ready":false,"error":{"code":"UNKNOWN"}}\n',
    '{"ready":true,"initMs":1}\n{}\n',
    " ".repeat(16_384) + "\n",
    new Uint8Array([0xff, 10]),
  ]) {
    const result = decodeOcrStartupRecord({
      input,
      requestedLanguages: ["eng"],
    });
    expect(result instanceof Error).toBe(true);
    if (result instanceof Error) expect(result.message).not.toContain("SECRET");
  }
  const input =
    JSON.stringify({
      ready: false,
      error: {
        code: "OCR_LANGUAGE_UNAVAILABLE",
        missingLanguages: ["\u001b[31m"],
      },
    }) + "\n";
  expect(
    decodeOcrStartupRecord({
      input,
      requestedLanguages: ["\u001b[31m"],
    }) instanceof Error
  ).toBe(true);
});

test("valid readiness and unknown initialization causes retain useful local guidance", () => {
  expect(
    decodeOcrStartupRecord({
      input: '{"ready":true,"initMs":0}\n',
      requestedLanguages: ["eng"],
    })
  ).toEqual({ ready: true, initMs: 0 });
  for (const code of ["OCR_INITIALIZATION_FAILED", "OCR_STARTUP_FAILED"]) {
    const record = decodeOcrStartupRecord({
      input: JSON.stringify({ ready: false, error: { code } }) + "\n",
      requestedLanguages: ["script/Latin", "pol"],
    });
    expect(record instanceof Error).toBe(false);
    if (record instanceof Error) return;
    const message = renderOcrStartupFailure({
      record,
      requestedLanguages: ["script/Latin", "pol"],
    });
    expect(message).toContain("script/Latin, pol");
    expect(message).toContain("Tesseract");
  }
});
