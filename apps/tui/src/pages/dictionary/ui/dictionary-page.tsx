import { useDictionary } from "@dictos/react";

import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { FolderTreePane } from "./folder-tree-pane";
import { DescriptionPane } from "./description-pane";

import { useTheme } from "@shared/lib/theme";
import { useKeyboard } from "@opentui/react";

export const DictionaryPage = () => {
  const theme = useTheme();

  const { state, selectedTreeItem, selectedDescription, actions } =
    useDictionary();

  useKeyboard((key) => {
    if (state.focus.action !== "idle") {
      if (key.name === "escape") actions.general.cancelAction();
    }

    if (key.name === "j" || key.name === "down")
      actions.navigation.moveSelectionDown();
    if (key.name === "k" || key.name === "up")
      actions.navigation.moveSelectionUp();
    if (key.name === "return" || key.name === "l" || key.name === "right")
      actions.navigation.navigateIn();
    if (key.name === "backspace" || key.name === "h" || key.name === "left")
      actions.navigation.navigateOut();

    if (state.focus.pane === "tree") {
      if (key.name === "a") actions.tree.requestCreate();
      if (key.name === "r") actions.tree.requestRename();
      if (key.name === "d") actions.tree.requestDelete();
    } else if (state.focus.pane === "description") {
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

      {state.focus.pane === "tree" && state.focus.action === "createInput" && (
        <CreateModal
          value={state.inputValue}
          onChange={actions.general.updateInputValue}
          // @ts-expect-error opentui type collision bug
          onSubmit={actions.tree.submitCreate}
          focused
        />
      )}

      {state.focus.pane === "tree" &&
        state.focus.action === "deleteConfirm" && (
          <DeleteConfirmModal
            itemName={
              selectedTreeItem?.type === "folder"
                ? `${selectedTreeItem.data.name}/`
                : selectedTreeItem?.data.text
            }
            onConfirm={actions.tree.confirmDelete}
            onCancel={actions.general.cancelAction}
          />
        )}

      {state.focus.pane === "description" &&
        state.focus.action === "deleteConfirm" && (
          <DeleteConfirmModal
            itemName={selectedDescription?.text}
            onConfirm={actions.description.confirmDelete}
            onCancel={actions.general.cancelAction}
          />
        )}
    </box>
  );
};
