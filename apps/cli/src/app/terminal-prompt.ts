import * as errore from "@dictos/errore";
import { PromptError } from "./errors";
import type { TerminalPrompt } from "./types";

export const createTerminalPrompt = (): TerminalPrompt => ({
  readSecret: (label) =>
    readTerminalInput({ label, hidden: true }).then((result) => {
      if (result instanceof Error || result === false)
        return result instanceof Error
          ? result
          : new PromptError({ reason: "Cancelled by user" });
      if (result.trim() === "")
        return new PromptError({ reason: "Secret cannot be empty" });
      return result;
    }),
  confirm: (label) =>
    readTerminalInput({ label: `${label} [y/N] `, hidden: false }).then(
      (result) => {
        if (result instanceof Error || result === false) return result;
        return /^(y|yes)$/i.test(result.trim());
      }
    ),
});

function readTerminalInput(input: {
  label: string;
  hidden: boolean;
}): Promise<string | false | PromptError> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    return Promise.resolve(
      new PromptError({ reason: "cannot read from non-interactive terminal" })
    );

  return new Promise((resolve) => {
    let value = "";
    const finish = (result: string | false | PromptError) => {
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      process.stdout.write("\n");
      const restored = errore.try(
        () => process.stdin.setRawMode(false),
        (cause) =>
          new PromptError({ reason: "could not restore terminal mode", cause })
      );
      resolve(restored instanceof Error ? restored : result);
    };
    const onData = (character: string) => {
      if (character === "\u0003" || character === "\u0004")
        return finish(false);
      if (character === "\n" || character === "\r") return finish(value);
      if (character === "\u007F" || character === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
      if (!input.hidden) process.stdout.write(character);
    };

    const configured = errore.try(
      () => {
        process.stdout.write(input.label);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", onData);
      },
      (cause) =>
        new PromptError({ reason: "could not configure terminal input", cause })
    );
    if (configured instanceof Error) finish(configured);
  });
}
