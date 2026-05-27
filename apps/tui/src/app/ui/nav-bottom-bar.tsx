import { useTheme } from "@shared/lib/theme";

export const NavBottomBar = () => {
  const theme = useTheme();

  return (
    <box
      position="absolute"
      width="80%"
      height={5}
      bottom={2}
      left="10%"
      backgroundColor={theme.base00}
      borderColor="white"
    >
      <text>dictionary</text>
      <text>auth</text>
    </box>
  );
};
