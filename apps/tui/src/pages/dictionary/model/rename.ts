import { useDictionaryStore, useSelected } from "./use-dictionary-store";
import { useServices } from "@shared/lib/services";

export const useRenameLogic = () => {
  const {
    focus,
    setFocus,
    setInputValue,
    treeItemsToDisplay,
    definitionsToDisplay,
    setRefreshTreeItemTrigger,
    setDefinitionRefreshTrigger,
  } = useDictionaryStore();

  const { selectedTreeItem, selectedDefinition } = useSelected();

  const { captureService, definitionService, directoryService } = useServices();

  const actionRequestRename = () => {
    if (focus.pane === "tree" && treeItemsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "renameInput" }));

      if (selectedTreeItem?.type === "dir") {
        setInputValue(selectedTreeItem.data.name);
      } else if (selectedTreeItem?.type === "capture") {
        setInputValue(selectedTreeItem?.data.text);
      }
    }

    if (focus.pane === "definition" && definitionsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "renameInput" }));

      setInputValue(selectedDefinition!.text);
    }
  };

  const handleRenameTreeItemSubmit = async (val: string) => {
    if (focus.action === "renameInput" && focus.pane === "tree") {
      const trimmed = val.trim();
      if (!trimmed || !selectedTreeItem) {
        setFocus({ pane: "tree", action: "idle" });
        return;
      }

      if (selectedTreeItem.type === "dir") {
        await directoryService
          .renameDirectory(selectedTreeItem.data.id, trimmed)
          .catch(console.error);
      } else {
        await captureService
          .updateCapture(selectedTreeItem.data.id, { text: trimmed })
          .catch(console.error);
      }

      setRefreshTreeItemTrigger();
      setFocus({ pane: "tree", action: "idle" });
    }
  };

  const handleRenameDefinitionSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || !selectedDefinition) {
      setFocus({ pane: "definition", action: "idle" });
      return;
    }

    await definitionService
      .updateDefinition(selectedDefinition!.id, {
        captureId: selectedDefinition?.captureId,
        text: trimmed,
      })
      .catch(console.error);

    setDefinitionRefreshTrigger();
    setFocus({ pane: "definition", action: "idle" });
  };

  return {
    actionRequestRename,
    handleRenameDefinitionSubmit,
    handleRenameTreeItemSubmit,
  };
};
