import { useServicesStore } from "@shared/lib/services/services-store";

import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { DirectoryTreePane } from "./directory-tree-pane";
import { DefinitionPane } from "./definition-pane";
import { useDictionaryStore, useSelected } from "../model/use-dictionary-store";

export const DictionaryPage = () => {
  const { captureService, definitionService, directoryService } =
    useServicesStore();

  if (!captureService || !definitionService || !directoryService) return;

  const {
    pathStack,
    handleCreateSubmit,
    handleDeleteDefinitionConfirm,
    handleDeleteTreeItemConfirm,
    handleDeleteConfirmModalCancel,
    handleDefinitionSubmit,
  } = useDictionary({ captureService, directoryService, definitionService });

  const { focus } = useDictionaryStore();

  const { selectedTreeItem, selectedDefinition } = useSelected();

  return (
    <box
      height="100%"
      flexDirection="row"
    >
      <DirectoryTreePane pathStack={pathStack} />

      <DefinitionPane handleDefinitionSubmit={handleDefinitionSubmit} />

      {focus.pane === "tree" && focus.action === "createInput" && (
        <CreateModal
          // @ts-expect-error opentui type collision bug
          onSubmit={handleCreateSubmit}
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
