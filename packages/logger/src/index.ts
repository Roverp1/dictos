export type Context = Record<string, unknown>;

export interface Logger {
  child(context: Context): Logger;

  trace(message: string, context?: Context): void;
  debug(message: string, context?: Context): void;
  info(message: string, context?: Context): void;
  warn(message: string, context?: Context): void;
  error(message: string, error?: Error | unknown, context?: Context): void;
  fatal(message: string, error?: Error | unknown, context?: Context): void;
}
