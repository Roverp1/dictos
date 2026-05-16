import { useDictionaryStore } from "@pages/dictionary/model/use-dictionary-store";

import type { InputProps } from "@opentui/react";

interface CreateModalProps extends InputProps {}

export const CreateModal = ({ ...props }: CreateModalProps) => {
  const { inputValue, setInputValue } = useDictionaryStore();

  return (
    <box
      position="absolute"
      left="50%"
      top="12%"
      width="30%"
      height={3}
      border
      borderColor="#a8a29e"
      title="Create:"
      titleAlignment="left"
    >
      <input
        {...props}
        value={inputValue}
        onChange={setInputValue}
      />
    </box>
  );
};
