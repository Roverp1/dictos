import { useDictionaryStore, useHelperVariables } from "@entities/dictionary";
import { useTheme } from "@shared/lib/theme";

import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { FolderTreePane } from "./folder-tree-pane";
import { DescriptionPane } from "./description-pane";
import { useCreateLogic } from "../model/create";
import { useDeleteLogic } from "../model/delete";

export const DictionaryPage = () => {
  const theme = useTheme();

  useDictionary();

  const { focus } = useDictionaryStore();

  const { selectedTreeItem, selectedDescription } = useHelperVariables();

  const { handleCreateTreeItemSubmit } = useCreateLogic();

  const {
    handleDeleteTreeItemConfirm,
    handleDeleteConfirmModalCancel,
    handleDeleteDescriptionConfirm,
  } = useDeleteLogic();
  return (
    <box
      height="100%"
      flexDirection="row"
      backgroundColor={theme.base00}
    >
      <FolderTreePane />

      <DescriptionPane />

      {focus.pane === "tree" && focus.action === "createInput" && (
        <CreateModal
          // @ts-expect-error opentui type collision bug
          onSubmit={handleCreateTreeItemSubmit}
          focused
        />
      )}

      {focus.pane === "tree" && focus.action === "deleteConfirm" && (
        <DeleteConfirmModal
          itemName={
            selectedTreeItem?.type === "folder"
              ? `${selectedTreeItem.data.name}/`
              : selectedTreeItem?.data.text
          }
          onConfirm={handleDeleteTreeItemConfirm}
          onCancel={handleDeleteConfirmModalCancel}
        />
      )}

      {focus.pane === "description" && focus.action === "deleteConfirm" && (
        <DeleteConfirmModal
          itemName={selectedDescription?.text}
          onConfirm={handleDeleteDescriptionConfirm}
          onCancel={handleDeleteConfirmModalCancel}
        />
      )}
    </box>
  );
};
