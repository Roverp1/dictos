import type { PinoLogFormat } from "./types";

const LEVEL_NAMES = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO ",
  40: "WARN ",
  50: "ERROR",
  60: "FATAL",
} as const;

const LEVEL_METHODS = {
  10: "debug",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "error",
} as const;

const LEVEL_COLORS = {
  10: "#64748b", // TRACE
  20: "#0284c7", // DEBUG
  30: "#059669", // INFO
  40: "#f59e0b", // WARN
  50: "#dc2626", // ERROR
  60: "#e11d48", // FATAL
} as const;

export const pinoPrettifyBrowser = (logObj: PinoLogFormat) => {
  const { level, time, msg, ...rest } = logObj;

  const levelName = LEVEL_NAMES[level as keyof typeof LEVEL_NAMES] || "LOG";
  const method = LEVEL_METHODS[level as keyof typeof LEVEL_METHODS] || "log";
  const color = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || "#000";
  const timestamp = new Date(time).toLocaleTimeString();

  const args: unknown[] = [
    `%c[${timestamp}] %c${levelName}: %c${msg}`,
    `color: gray; font-weight: lighter;`,
    `color: ${color}; font-size: 1.2em;`,
    `color: inherit; font-weight: bold`,
  ];

  if (Object.keys(rest).length > 0) {
    args.push(rest);
  }

  (console as any)[method](...args);
};
