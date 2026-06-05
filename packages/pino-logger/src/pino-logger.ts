import type { Logger, Context } from "@dictos/logger";

import pino from "pino";

export class PinoLoggerAdapter implements Logger {
  private logger: pino.Logger;

  constructor(logFilePath: string) {
    this.logger = pino(pino.destination(logFilePath));
  }

  debug(message: string, context?: Context): void {
    if (context) this.logger.debug(context, message);
    else this.logger.debug(message);
  }
  info(message: string, context?: Context): void {
    if (context) this.logger.debug(context, message);
    else this.logger.debug(message);
  }
  warn(message: string, context?: Context): void {
    if (context) this.logger.debug(context, message);
    else this.logger.debug(message);
  }
  error(message: string, error?: Error | unknown, context?: Context): void {
    this.logger.error({ err: error, ...context }, message);
  }

  fatal(message: string, error?: Error | unknown, context?: Context): void {
    this.logger.fatal({ err: error, ...context }, message);
  }
}
