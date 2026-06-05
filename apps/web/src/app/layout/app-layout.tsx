import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { NavBottomBar } from "../ui/nav-bottom-bar";
import { useTheme } from "../../shared/lib/theme";

export const AppLayout = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: theme.base00,
        color: theme.base05,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: theme.base01,
            color: theme.base05,
            border: `1px solid ${theme.base02}`,
          },
        }}
      />

      <main
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Outlet />
      </main>

      <NavBottomBar />
    </div>
  );
};
