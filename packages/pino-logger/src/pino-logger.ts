import type { Logger, Context } from "@dictos/logger";

import pino from "pino";

export class PinoLoggerAdapter implements Logger {
  constructor(private logger: pino.Logger) {}

  child(context: Context): Logger {
    return new PinoLoggerAdapter(this.logger.child(context));
  }

  trace(message: string, context?: Context): void {
    if (context) this.logger.trace(context, message);
    else this.logger.trace(message);
  }
  debug(message: string, context?: Context): void {
    if (context) this.logger.debug(context, message);
    else this.logger.debug(message);
  }
  info(message: string, context?: Context): void {
    if (context) this.logger.info(context, message);
    else this.logger.info(message);
  }
  warn(message: string, context?: Context): void {
    if (context) this.logger.warn(context, message);
    else this.logger.warn(message);
  }
  error(message: string, error?: Error | unknown, context?: Context): void {
    this.logger.error({ err: error, ...context }, message);
  }

  fatal(message: string, error?: Error | unknown, context?: Context): void {
    this.logger.fatal({ err: error, ...context }, message);
  }
}
