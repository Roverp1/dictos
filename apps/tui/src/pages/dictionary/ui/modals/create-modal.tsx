import type { InputProps } from "@opentui/react";

import { useDictionaryStore } from "@entities/dictionary";
import { useTheme } from "@shared/lib/theme";

interface CreateModalProps extends InputProps {}

export const CreateModal = ({ ...props }: CreateModalProps) => {
  const { inputValue, setInputValue } = useDictionaryStore();

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
      <input
        {...props}
        value={inputValue}
        onChange={setInputValue}
      />
    </box>
  );
};
