export interface PinoLogFormat extends Record<string, unknown> {
  level: number;
  time: number;
  msg?: string;
  pid?: number;
  hostname?: string;
  v?: number;
  err?: unknown;
}
