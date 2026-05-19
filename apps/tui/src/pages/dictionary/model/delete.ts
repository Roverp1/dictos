import { useServices } from "@shared/lib/services";
import { useDictionaryStore, useHelperVariables } from "./use-dictionary-store";

export const useDeleteLogic = () => {
  const {
    definitionRefreshTrigger,
    definitionsToDisplay,
    focus,
    inputValue,
    refreshTreeItemTrigger,
    selectedDefinitionIndex,
    selectedTreeItemIndex,
    setDefinitionRefreshTrigger,
    setDefinitionsToDisplay,
    setFocus,
    setInputValue,
    setRefreshTreeItemTrigger,
    setSelectedDefinitionIndex,
    setSelectedTreeItemIndex,
    setTreeItemsToDisplay,
    treeItemsToDisplay,
  } = useDictionaryStore();

  const { captureService, definitionService, directoryService } = useServices();

  const { currentDir, selectedDefinition, selectedTreeItem } =
    useHelperVariables();

  const handleDeleteTreeItemConfirm = async () => {
    if (selectedTreeItem!.type === "capture" && focus.pane === "tree") {
      await captureService
        .deleteCapture(selectedTreeItem!.data.id)
        .catch(console.error);
    } else if (selectedTreeItem!.type === "dir") {
      await directoryService
        .deleteDirectory(selectedTreeItem!.data.id)
        .catch(console.error);
    }

    setRefreshTreeItemTrigger();
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDeleteDefinitionConfirm = async () => {
    if (focus.pane === "definition") {
      await definitionService.deleteDefinition(selectedDefinition!.id);
      setDefinitionRefreshTrigger();
      setFocus({ pane: "definition", action: "idle" });
    }
  };

  const handleDeleteConfirmModalCancel = () => {
    setFocus({ pane: "tree", action: "idle" });
  };

  const actionRequestDelete = () => {
    if (focus.pane === "tree" && treeItemsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }

    if (focus.pane === "definition" && definitionsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }
  };

  return {
    handleDeleteTreeItemConfirm,
    handleDeleteConfirmModalCancel,
    actionRequestDelete,
    handleDeleteDefinitionConfirm,
  };
};
