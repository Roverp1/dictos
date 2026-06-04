import { useTheme } from "@shared/lib/theme";

import type { InputProps } from "@opentui/react";

interface CreateModalProps extends InputProps {
  value: string;
  onChange: (val: string) => void;
}

export const CreateModal = ({ ...props }: CreateModalProps) => {
  const theme = useTheme();

  return (
    <box
      position="absolute"
      left="25%"
      top="0%"
      width="24%"
      height={3}
      border
      borderColor="#a8a29e"
      title="Create:"
      titleAlignment="left"
      backgroundColor={theme.base00}
    >
      <input {...props} />
    </box>
  );
};
