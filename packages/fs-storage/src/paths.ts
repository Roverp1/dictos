import os from "os";
import fs from "fs/promises";
import path from "path";

import { StorageError } from "@dictos/core";

export const getAppDataDir = (appName: string): string => {
  if (process.env.NODE_ENV === "development") {
    return path.join(process.cwd(), ".data");
  }

  const home = os.homedir();
  const platform = process.platform;

  switch (platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", appName);

    case "win32":
      const appData =
        process.env.APPDATA || path.join(home, "AppData", "Roaming");
      return path.join(appData, appName);

    case "linux":
    default:
      const xdgDataHome =
        process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
      return path.join(xdgDataHome, appName);
  }
};

export const getDictosDataDir = async (): Promise<string | StorageError> => {
  const dictosDataDir = getAppDataDir("dictos");

  const mkDirResult = await fs.mkdir(dictosDataDir, { recursive: true }).catch(
    (e) =>
      new StorageError({
        operation: "fs_mkdir",
        reason: "Could not create app data dir",
        cause: e,
      })
  );

  if (mkDirResult instanceof Error) return mkDirResult;

  return dictosDataDir;
};
