import { useKeyboard } from "@opentui/react";
import type { FocusState } from "@pages/dictionary/model/use-dictionary";

interface DeleteConfirmModalProps {
  focus: FocusState;
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal = ({
  focus,
  itemName,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) => {
  if (!itemName) return;

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
        title={`Delete "${itemName}"?`}
        titleAlignment="center"
        flexDirection="column"
        justifyContent="space-between"
        width="35%"
        height={15}
      >
        <box flexGrow={1}>
          <text>Are you sure you want to delete this item</text>
        </box>

        <box
          border={["top"]}
          flexDirection="row"
          justifyContent="space-around"
        >
          <text>[Y]es</text>
          <text>[N]o</text>
        </box>
      </box>
    </box>
  );
};
