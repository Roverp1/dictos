import type { CliOutput } from "./types";

export const createCliOutput = (): CliOutput => ({
  writeData(text) {
    process.stdout.write(`${text}\n`);
  },

  writeError(text) {
    process.stderr.write(`\x1b[31merror\x1b[38;5;244m:\x1b[0m ${text}\n`);
  },
});
