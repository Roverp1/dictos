import { useDictionary } from "@dictos/react";

import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { FolderTreePane } from "./folder-tree-pane";
import { DescriptionPane } from "./description-pane";

import { useTheme } from "@shared/lib/theme";
import { useKeyboard } from "@opentui/react";

export const DictionaryPage = () => {
  const theme = useTheme();

  const { state, treeCursorItem, descriptionCursorItem, actions } =
    useDictionary();

  useKeyboard((key) => {
    if (state.interactionAction !== "idle") {
      if (key.name === "escape") actions.general.cancelAction();
    }

    if (key.name === "j" || key.name === "down")
      actions.navigation.moveCursor("down");
    if (key.name === "k" || key.name === "up")
      actions.navigation.moveCursor("up");
    if (key.name === "return" || key.name === "l" || key.name === "right")
      actions.navigation.navigateIn();
    if (key.name === "backspace" || key.name === "h" || key.name === "left")
      actions.navigation.navigateOut();

    if (state.activePane === "tree") {
      if (key.name === "a") actions.tree.requestCreate();
      if (key.name === "r") actions.tree.requestRename();
      if (key.name === "d") actions.tree.requestDelete();
    } else if (state.activePane === "description") {
      if (key.name === "a") actions.description.requestCreate();
      if (key.name === "r") actions.description.requestRename();
      if (key.name === "d") actions.description.requestDelete();
    }
  });

  return (
    <box
      height="100%"
      flexDirection="row"
      backgroundColor={theme.base00}
    >
      <FolderTreePane />

      <DescriptionPane />

      {state.activePane === "tree" &&
        state.interactionAction === "createInput" && (
          <CreateModal
            value={state.inputValue}
            onChange={actions.general.updateInputValue}
            // @ts-expect-error opentui type collision bug
            onSubmit={actions.tree.submitCreate}
            focused
          />
        )}

      {state.activePane === "tree" &&
        state.interactionAction === "deleteConfirm" && (
          <DeleteConfirmModal
            itemName={
              treeCursorItem?.type === "folder"
                ? `${treeCursorItem.data.name}/`
                : treeCursorItem?.data.text
            }
            onConfirm={actions.tree.confirmDelete}
            onCancel={actions.general.cancelAction}
          />
        )}

      {state.activePane === "description" &&
        state.interactionAction === "deleteConfirm" && (
          <DeleteConfirmModal
            itemName={descriptionCursorItem?.text}
            onConfirm={actions.description.confirmDelete}
            onCancel={actions.general.cancelAction}
          />
        )}
    </box>
  );
};
