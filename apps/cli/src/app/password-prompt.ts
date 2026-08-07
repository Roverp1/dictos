import type { PasswordPrompt } from "./types";
import { PasswordPromptError } from "./errors";

export const createPasswordPrompt = (): PasswordPrompt => ({
  async readPassword(label) {
    if (!process.stdin.isTTY) {
      return new PasswordPromptError({
        reason: "cannot read password from non-interactive terminal",
      });
    }

    return new Promise((resolve) => {
      process.stdout.write(label);

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      let password = "";

      process.stdin.on("data", function onData(char: string) {
        // on Enter
        if (char === "\n" || char === "\r" || char === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onData);
          process.stdin.pause();
          process.stdout.write("\n");

          if (password.trim().length === 0) {
            resolve(
              new PasswordPromptError({ reason: "Password cannot be empty" })
            );
            return;
          } else {
            resolve(password);
            return;
          }
        }

        // on Ctrl + C
        if (char === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.removeListener("data", onData);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(new PasswordPromptError({ reason: "Cancelled by user" }));
          return;
        }

        if (char === "\u007F" || char === "\b" || char === "\x7f") {
          if (password.trim().length > 0) {
            password = password.slice(0, -1);
          }
          return;
        }

        password += char;
      });
    });
  },
});
