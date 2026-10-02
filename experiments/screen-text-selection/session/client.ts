import net from "node:net";
import * as errore from "../../../packages/errore/src/index.ts";

class OcrTransportError extends errore.createTaggedError({
  name: "OcrTransportError",
  message: "$reason",
}) {}

function request(
  socketPath: string,
  command: string
): Promise<string | OcrTransportError> {
  return new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    const decoder = new TextDecoder();
    let response = "";
    let settled = false;
    const finish = (result: string | OcrTransportError) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(120000);
    socket.on("connect", () => socket.write(command + "\n"));
    socket.on("data", (chunk) => {
      response +=
        typeof chunk === "string"
          ? chunk
          : decoder.decode(chunk, { stream: true });
      if (response.length > 20_000_000)
        finish(new OcrTransportError({ reason: "OCR response too large." }));
      else if (response.includes("\n"))
        finish(response.slice(0, response.indexOf("\n")));
    });
    socket.on("end", () =>
      finish(
        new OcrTransportError({
          reason: "OCR server closed without a response.",
        })
      )
    );
    socket.on("timeout", () =>
      finish(new OcrTransportError({ reason: "OCR server timed out." }))
    );
    socket.on("error", (cause) =>
      finish(
        new OcrTransportError({ reason: "OCR server unavailable.", cause })
      )
    );
  });
}

const [socketPath, mode, ...args] = process.argv.slice(2);
const command =
  mode === "full" && args.length === 1
    ? `FULL ${args[0]}`
    : mode === "crop" && args.length === 5
      ? `CROP ${args.join(" ")}`
      : null;
if (!socketPath || !command || !args.every((value) => /^\d+$/.test(value))) {
  console.log(JSON.stringify({ error: "Invalid OCR request." }));
  process.exitCode = 2;
} else {
  const result = await request(socketPath, command);
  console.log(
    result instanceof Error ? JSON.stringify({ error: result.message }) : result
  );
  if (result instanceof Error) process.exitCode = 1;
}
