import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useServices } from "@dictos/react";
import { useTheme } from "../../shared/lib/theme";

export const NavBottomBar = () => {
  const [isHovered, setIsHovered] = useState(false);
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { syncService } = useServices();

  const handleSync = async () => {
    toast.promise(syncService.sync(), {
      loading: "Synchronizing...",
      success: "Synchronization successful!",
      error: (err: any) => err.reason || err.message || "Synchronization failed",
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "1") navigate("/auth");
      if (e.key === "2") navigate("/dictionary");
      if (e.key === "3") handleSync();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, syncService]);

  const navItemStyle = (path: string) => ({
    padding: "0.5rem 1.5rem",
    cursor: "pointer",
    backgroundColor: location.pathname === path ? theme.base0D : theme.base02,
    color: theme.base07,
    border: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    transition: "background-color 0.2s",
  });

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "absolute",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        width: "fit-content",
        padding: "0.5rem",
        backgroundColor: theme.base01,
        border: `2px solid ${isHovered ? theme.base0D : theme.base04}`,
        display: "flex",
        gap: "0.5rem",
        zIndex: 1000,
      }}
    >
      <div style={navItemStyle("/auth")} onClick={() => navigate("/auth")}>
        [1] auth
      </div>
      <div style={navItemStyle("/dictionary")} onClick={() => navigate("/dictionary")}>
        [2] dictionary
      </div>
      <div 
        style={{ ...navItemStyle(""), backgroundColor: theme.base02 }} 
        onClick={handleSync}
      >
        [3] synchronise
      </div>
    </div>
  );
};
