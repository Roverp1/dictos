import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { DirectoryTreePane } from "./directory-tree-pane";
import { DefinitionPane } from "./definition-pane";
import { useDictionaryStore, useSelected } from "../model/use-dictionary-store";
import { useCreateLogic } from "../model/create";
import { useDeleteLogic } from "../model/delete";

export const DictionaryPage = () => {
  useDictionary();

  const { focus } = useDictionaryStore();

  const { selectedTreeItem, selectedDefinition } = useSelected();

  const { handleCreateTreeItemSubmit } = useCreateLogic();

  const {
    handleDeleteTreeItemConfirm,
    handleDeleteConfirmModalCancel,
    handleDeleteDefinitionConfirm,
  } = useDeleteLogic();
  return (
    <box
      height="100%"
      flexDirection="row"
    >
      <DirectoryTreePane />

      <DefinitionPane />

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
            selectedTreeItem?.type === "dir"
              ? `${selectedTreeItem.data.name}/`
              : selectedTreeItem?.data.text
          }
          onConfirm={handleDeleteTreeItemConfirm}
          onCancel={handleDeleteConfirmModalCancel}
        />
      )}

      {focus.pane === "definition" && focus.action === "deleteConfirm" && (
        <DeleteConfirmModal
          itemName={selectedDefinition?.text}
          onConfirm={handleDeleteDefinitionConfirm}
          onCancel={handleDeleteConfirmModalCancel}
        />
      )}
    </box>
  );
};
