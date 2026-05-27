import { useKeyboard } from "@opentui/react";

import { useTheme } from "@shared/lib/theme";

import { useDictionaryStore } from "../../model/use-dictionary-store";

interface DeleteConfirmModalProps {
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal = ({
  itemName,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) => {
  if (!itemName) return;

  const { focus } = useDictionaryStore();

  const theme = useTheme();

  useKeyboard((key) => {
    if (focus.action === "deleteConfirm") {
      if (key.name === "y") onConfirm();
      if (key.name === "n") onCancel();
    }
  });

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <box
        border
        borderColor={theme.base0D}
        titleAlignment="center"
        flexDirection="column"
        justifyContent="space-between"
        width="35%"
        height={15}
        backgroundColor={theme.base00}
      >
        <box
          flexGrow={1}
          justifyContent="center"
          alignItems="center"
        >
          <text>Are you sure you want to delete this item?</text>
        </box>

        <box
          border={["top"]}
          borderColor={theme.base0D}
          flexDirection="row"
          justifyContent="space-around"
        >
          <box
            border={["right"]}
            borderColor={theme.base0D}
            width="50%"
            alignItems="center"
          >
            <text>[Y]es</text>
          </box>

          <box
            width="50%"
            alignItems="center"
          >
            <text>[N]o</text>
          </box>
        </box>
      </box>

      <box
        position="absolute"
        width="35%"
        height={15}
        alignItems="center"
      >
        <text>Delete"${itemName}"?</text>
      </box>
    </box>
  );
};
