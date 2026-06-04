import { useServices } from "../../../providers";
import { useDictionaryStore } from "../use-dictionary-store";

export const useTreeActions = () => {
  const { entryService, folderService, logger } = useServices();
  const {
    focus,
    treeItemsToDisplay,
    selectedTreeItemIndex,
    pathStack,
    setInputValue,
    setFocus,
    setRefreshTreeItemTrigger,
  } = useDictionaryStore();

  const currentFolder = pathStack[pathStack.length - 1];
  const selectedTreeItem = treeItemsToDisplay[selectedTreeItemIndex];

  return {
    requestCreate: () => {
      setInputValue("");
      setFocus({ pane: "tree", action: "createInput" });
    },

    submitCreate: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setFocus({ pane: "tree", action: "idle" });
        return;
      }

      if (!currentFolder) {
        logger.error("Trying to create an item with no parent folder");
        return;
      }

      if (trimmed.endsWith("/")) {
        const name = trimmed.slice(0, -1);
        const res = await folderService.createFolder({
          name: name,
          parentId: currentFolder.id,
        });
        if (res instanceof Error) {
          logger.error("Failed to create folder.", res);
          return;
        }
      } else {
        const res = await entryService.createEntry({
          text: trimmed,
          folderId: currentFolder.id,
        });
        if (res instanceof Error) {
          logger.error("Failed to create entry.", res);
          return;
        }
      }

      setRefreshTreeItemTrigger();
      setFocus({ pane: "tree", action: "idle" });
    },

    requestRename: () => {
      if (
        focus.pane === "tree" &&
        focus.action === "idle" &&
        treeItemsToDisplay.length > 0 &&
        selectedTreeItem
      ) {
        setFocus({ pane: "tree", action: "renameInput" });

        if (selectedTreeItem.type === "folder") {
          setInputValue(selectedTreeItem.data.name);
        } else if (selectedTreeItem.type === "entry") {
          setInputValue(selectedTreeItem.data.text);
        }
      }
    },

    submitRename: async (val: string) => {
      if (focus.action === "renameInput" && focus.pane === "tree") {
        const trimmed = val.trim();
        if (!trimmed || !selectedTreeItem) {
          setFocus({ pane: "tree", action: "idle" });
          return;
        }

        if (selectedTreeItem.type === "folder") {
          const res = await folderService.renameFolder(
            selectedTreeItem.data.id,
            trimmed
          );
          if (res instanceof Error) {
            logger.error("Failed to rename folder", res);
            return;
          }
        } else {
          const res = await entryService.updateEntry(selectedTreeItem.data.id, {
            text: trimmed,
          });
          if (res instanceof Error) {
            logger.error("Failed to rename entry", res);
            return;
          }
        }

        setRefreshTreeItemTrigger();
        setFocus({ pane: "tree", action: "idle" });
      }
    },

    requestDelete: () => {
      if (
        focus.pane === "tree" &&
        focus.action === "idle" &&
        treeItemsToDisplay.length > 0
      ) {
        setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
      }
    },

    confirmDelete: async () => {
      if (selectedTreeItem!.type === "entry" && focus.pane === "tree") {
        const res = await entryService.deleteEntry(selectedTreeItem!.data.id);
        if (res instanceof Error) {
          logger.error("Failed to delete entry", res);
          return;
        }
      } else if (selectedTreeItem!.type === "folder") {
        const res = await folderService.deleteFolder(selectedTreeItem!.data.id);
        if (res instanceof Error) {
          logger.error("Failed to delete folder", res);
          return;
        }
      }

      setRefreshTreeItemTrigger();
      setFocus({ pane: "tree", action: "idle" });
    },
  };
};
