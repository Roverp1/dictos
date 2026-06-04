import { useKeyboard } from "@opentui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "@opentui-ui/toast";

import { useServices } from "@dictos/react";

import { useTheme } from "@shared/lib/theme";

export const NavBottomBar = () => {
  const [isBarActive, setIsBarActive] = useState<boolean>(false);

  const theme = useTheme();

  const location = useLocation();
  const navigate = useNavigate();

  const { syncService } = useServices();

  const handleSync = async () => {
    const performSync = async () => {
      const result = await syncService.sync();

      if (result instanceof Error) {
        console.error(result);
        throw result;
      }

      return result;
    };

    const user = await toast
      .promise(performSync(), {
        loading: "Synchronizing...",
        success: "Synchorization successful!",
        error: (err: any) =>
          err.reason || err.message || "Synchronization failed",
      })
      ?.unwrap()
      .catch(() => {});

    console.log("Sync is successful:", user);
  };

  useKeyboard((key) => {
    if (isBarActive === true && key.name === "escape") {
      setIsBarActive(false);
    }

    if (key.name === "1") {
      navigate("/auth");
      setIsBarActive(false);
    }

    if (key.name === "2") {
      navigate("/dictionary");
      setIsBarActive(false);
    }

    if (key.name === "3") {
      handleSync();
    }
  });

  return (
    <box
      position="absolute"
      width="80%"
      height={5}
      bottom={2}
      left="10%"
      paddingX={1}
      backgroundColor={theme.base00}
      borderColor={isBarActive ? theme.base0D : theme.base04}
      flexDirection="row"
      onMouseOver={() => setIsBarActive(true)}
      onMouseOut={() => setIsBarActive(false)}
      borderStyle="double"
    >
      <box
        paddingX={2}
        paddingY={1}
        backgroundColor={
          location.pathname === "/auth" ? theme.base0D : theme.base02
        }
        onMouseDown={() => navigate("/auth")}
      >
        <text>auth</text>
      </box>

      <box
        paddingX={2}
        paddingY={1}
        backgroundColor={
          location.pathname === "/dictionary" ? theme.base0D : theme.base02
        }
        onMouseDown={() => navigate("/dictionary")}
      >
        <text>dictionary</text>
      </box>

      <box
        paddingX={2}
        paddingY={1}
        backgroundColor={theme.base02}
        // onMouseDown={() => yourFunction()}
      >
        <text>synchronise</text>
      </box>
    </box>
  );
};
