import fs from "node:fs";
import path from "node:path";

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const chromiumExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ...(process.env.PATH ?? "")
    .split(path.delimiter)
    .flatMap((directory) =>
      ["chromium", "chromium-browser"].map((name) => path.join(directory, name))
    ),
].find((candidate) => candidate !== undefined && fs.existsSync(candidate));

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright({
        launchOptions: chromiumExecutable
          ? { executablePath: chromiumExecutable }
          : {},
      }),
    },
    testTimeout: 30_000,
  },
});
