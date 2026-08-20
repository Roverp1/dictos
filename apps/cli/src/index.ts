import { createCliContext } from "./app/context";
import { createCliProgram } from "./app/program";
import { CliExitCode } from "./app/types";

const context = createCliContext();
const program = createCliProgram(context);

await program.parseAsync().catch((err) => {
  process.exitCode = CliExitCode.UnexpectedFailure;
  context.output.writeError(err instanceof Error ? err.message : String(err));
});
