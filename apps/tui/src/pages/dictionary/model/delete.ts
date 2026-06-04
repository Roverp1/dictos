import { useServices } from "@shared/lib/services";
import { useDictionaryStore, useHelperVariables } from "@entities/dictionary";

export const useDeleteLogic = () => {
  const {
    descriptionsToDisplay,
    focus,
    setDescriptionRefreshTrigger,
    setFocus,
    setRefreshTreeItemTrigger,
    treeItemsToDisplay,
  } = useDictionaryStore();

  const { entryService, descriptionService, folderService } = useServices();

  const { selectedDescription, selectedTreeItem } = useHelperVariables();

  const handleDeleteTreeItemConfirm = async () => {
    if (selectedTreeItem!.type === "entry" && focus.pane === "tree") {
      await entryService
        .deleteEntry(selectedTreeItem!.data.id)
        .catch(console.error);
    } else if (selectedTreeItem!.type === "folder") {
      await folderService
        .deleteFolder(selectedTreeItem!.data.id)
        .catch(console.error);
    }

    setRefreshTreeItemTrigger();
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDeleteDescriptionConfirm = async () => {
    if (focus.pane === "description") {
      await descriptionService.deleteDescription(selectedDescription!.id);
      setDescriptionRefreshTrigger();
      setFocus({ pane: "description", action: "idle" });
    }
  };

  const handleDeleteConfirmModalCancel = () => {
    setFocus({ pane: "tree", action: "idle" });
  };

  const actionRequestDelete = () => {
    if (focus.pane === "tree" && treeItemsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }

    if (focus.pane === "description" && descriptionsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }
  };

  return {
    handleDeleteTreeItemConfirm,
    handleDeleteConfirmModalCancel,
    actionRequestDelete,
    handleDeleteDescriptionConfirm,
  };
};
