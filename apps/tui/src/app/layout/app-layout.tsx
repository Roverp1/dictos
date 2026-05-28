import { NavBottomBar } from "@app/ui/nav-bottom-bar";
import { useTheme } from "@shared/lib/theme";
import { Outlet } from "react-router-dom";

export const AppLayout = () => {
  const theme = useTheme();

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={theme.base00}
    >
      <box
        width="100%"
        height="100%"
      >
        <Outlet />
      </box>

      <NavBottomBar />
    </box>
  );
};
