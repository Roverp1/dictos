import { useDictionaryStore, useHelperVariables } from "./use-dictionary-store";
import { useServices } from "@shared/lib/services";

export const useRenameLogic = () => {
  const {
    focus,
    setFocus,
    setInputValue,
    treeItemsToDisplay,
    descriptionsToDisplay,
    setRefreshTreeItemTrigger,
    setDescriptionRefreshTrigger,
  } = useDictionaryStore();

  const { selectedTreeItem, selectedDescription } = useHelperVariables();

  const { entryService, descriptionService, folderService } = useServices();

  const actionRequestRename = () => {
    if (focus.pane === "tree" && treeItemsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "renameInput" }));

      if (selectedTreeItem?.type === "folder") {
        setInputValue(selectedTreeItem.data.name);
      } else if (selectedTreeItem?.type === "entry") {
        setInputValue(selectedTreeItem?.data.text);
      }
    }

    if (focus.pane === "description" && descriptionsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "renameInput" }));

      setInputValue(selectedDescription!.text);
    }
  };

  const handleRenameTreeItemSubmit = async (val: string) => {
    if (focus.action === "renameInput" && focus.pane === "tree") {
      const trimmed = val.trim();
      if (!trimmed || !selectedTreeItem) {
        setFocus({ pane: "tree", action: "idle" });
        return;
      }

      if (selectedTreeItem.type === "folder") {
        await folderService
          .renameFolder(selectedTreeItem.data.id, trimmed)
          .catch(console.error);
      } else {
        await entryService
          .updateEntry(selectedTreeItem.data.id, { text: trimmed })
          .catch(console.error);
      }

      setRefreshTreeItemTrigger();
      setFocus({ pane: "tree", action: "idle" });
    }
  };

  const handleRenameDescriptionSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || !selectedDescription) {
      setFocus({ pane: "description", action: "idle" });
      return;
    }

    await descriptionService
      .updateDescription(selectedDescription!.id, {
        entryId: selectedDescription?.entryId,
        text: trimmed,
      })
      .catch(console.error);

    setDescriptionRefreshTrigger();
    setFocus({ pane: "description", action: "idle" });
  };

  return {
    actionRequestRename,
    handleRenameDescriptionSubmit,
    handleRenameTreeItemSubmit,
  };
};