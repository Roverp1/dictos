import os from "os";
import path from "path";

export const getAppDataDir = (appName: string): string => {
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
