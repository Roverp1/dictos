import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";

import { NavBottomBar } from "../ui/nav-bottom-bar";
import { useTheme } from "@shared/lib/theme";

export const AppLayout = () => {
  const theme = useTheme();

  return (
    <div
      width="100%"
      height="100%"
      backgroundColor={theme.base00}
    >
      <Toaster
        position="top-right"
        stackingMode="stack"
        toastOptions={{
          success: { style: { borderColor: theme.base0B } },
          error: { style: { borderColor: theme.base08 } },
        }}
      />

      <box
        width="100%"
        height="100%"
      >
        <Outlet />
      </box>

      <NavBottomBar />
    </div>
  );
};
