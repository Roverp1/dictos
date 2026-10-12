import { expect, test } from "bun:test";

import {
  readOverlayJsonRequest,
  serializeOverlayJsonResponse,
} from "./overlay-json";

type Request = { entryText: string; instructionText: string };

const validate = (value: unknown): Request | Error => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("entryText" in value) ||
    typeof value.entryText !== "string" ||
    !("instructionText" in value) ||
    typeof value.instructionText !== "string"
  )
    return new Error("Invalid fields");
  return { entryText: value.entryText, instructionText: value.instructionText };
};

test("reads one Polish request with escaped multiline text without waiting for EOF", async () => {
  const request: Request = {
    entryText: "Żółć\nzażółć",
    instructionText: "Pierwsza linia\nDruga linia",
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(`${JSON.stringify(request)}\n`);
      controller.enqueue(bytes.subarray(0, 9));
      controller.enqueue(bytes.subarray(9));
    },
  });

  expect(await readOverlayJsonRequest({ input: stream, validate })).toEqual(
    request
  );
});

test("rejects malformed and oversized request lines as values", async () => {
  const malformed = await readOverlayJsonRequest({
    input: '{"entryText":',
    validate,
  });
  const oversized = await readOverlayJsonRequest({
    input: JSON.stringify({
      entryText: "a".repeat(1024 * 1024),
      instructionText: "",
    }),
    validate,
  });

  expect(malformed).toBeInstanceOf(Error);
  expect(oversized).toBeInstanceOf(Error);
  expect(JSON.parse(serializeOverlayJsonResponse(malformed))).toEqual({
    ok: false,
    error: { code: "INVALID_REQUEST", message: "Invalid JSON request" },
  });
  expect(JSON.parse(serializeOverlayJsonResponse(oversized))).toEqual({
    ok: false,
    error: { code: "REQUEST_TOO_LARGE", message: "JSON request is too large" },
  });
});

test("rejects invalid fields and multiple lines without exposing validation details", async () => {
  const invalid = await readOverlayJsonRequest({
    input: '{"entryText":42,"instructionText":""}\n',
    validate,
  });
  const multiple = await readOverlayJsonRequest({
    input: "{}\n{}\n",
    validate,
  });

  expect(invalid).toBeInstanceOf(Error);
  expect(multiple).toBeInstanceOf(Error);
  expect(JSON.parse(serializeOverlayJsonResponse(invalid))).toEqual({
    ok: false,
    error: { code: "INVALID_REQUEST", message: "Invalid JSON request" },
  });
});

test("bounds stream input before a newline arrives", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024 + 1));
    },
  });

  const result = await readOverlayJsonRequest({ input: stream, validate });
  expect(JSON.parse(serializeOverlayJsonResponse(result))).toEqual({
    ok: false,
    error: { code: "REQUEST_TOO_LARGE", message: "JSON request is too large" },
  });
});

test("returns a fixed safe handled error instead of raw provider details", () => {
  const line = serializeOverlayJsonResponse(
    new Error("\u001b[31msecret key: sk-test; raw provider body"),
    "MODEL_UNAVAILABLE"
  );

  expect(JSON.parse(line)).toEqual({
    ok: false,
    error: {
      code: "MODEL_UNAVAILABLE",
      message: "Selected Model is unavailable",
    },
  });
  expect(line).not.toContain("secret");
  expect(line).not.toContain("\u001b");
});

test("serializes success as exactly one newline-terminated JSON envelope", () => {
  const data = { entryText: "Żółć\nzażółć" };
  const line = serializeOverlayJsonResponse(data);

  expect(line).toBe(`${JSON.stringify({ ok: true, data })}\n`);
  expect(line.match(/\n/g)).toHaveLength(1);
});
