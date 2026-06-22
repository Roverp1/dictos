import { useServices } from "../../../providers";
import { useDictionaryStore } from "../use-dictionary-store";

export const useTreeActions = () => {
  const { entryService, folderService, logger } = useServices();
  const {
    activePane,
    interactionAction,
    currentFolderItems,
    treeCursor,
    pathStack,
    setInputValue,
    setActivePane,
    setInteractionAction,
    setRefreshTreeItemTrigger,
  } = useDictionaryStore();

  const currentFolder = pathStack[pathStack.length - 1];
  const treeCursorItem = currentFolderItems[treeCursor];

  return {
    requestCreate: () => {
      setInputValue("");
      setActivePane("tree");
      setInteractionAction("createInput");
    },

    submitCreate: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setActivePane("tree");
        setInteractionAction("idle");
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
      setActivePane("tree");
      setInteractionAction("idle");
    },

    requestRename: () => {
      if (
        activePane === "tree" &&
        interactionAction === "idle" &&
        currentFolderItems.length > 0 &&
        treeCursorItem
      ) {
        setActivePane("tree");
        setInteractionAction("renameInput");

        if (treeCursorItem.type === "folder") {
          setInputValue(treeCursorItem.data.name);
        } else if (treeCursorItem.type === "entry") {
          setInputValue(treeCursorItem.data.text);
        }
      }
    },

    submitRename: async (val: string) => {
      if (interactionAction === "renameInput" && activePane === "tree") {
        const trimmed = val.trim();
        if (!trimmed || !treeCursorItem) {
          setActivePane("tree");
          setInteractionAction("idle");
          return;
        }

        if (treeCursorItem.type === "folder") {
          const res = await folderService.renameFolder(
            treeCursorItem.data.id,
            trimmed
          );
          if (res instanceof Error) {
            logger.error("Failed to rename folder", res);
            return;
          }
        } else {
          const res = await entryService.updateEntry(treeCursorItem.data.id, {
            text: trimmed,
          });
          if (res instanceof Error) {
            logger.error("Failed to rename entry", res);
            return;
          }
        }

        setRefreshTreeItemTrigger();
        setActivePane("tree");
        setInteractionAction("idle");
      }
    },

    requestDelete: () => {
      if (
        activePane === "tree" &&
        interactionAction === "idle" &&
        currentFolderItems.length > 0
      ) {
        setActivePane("tree");
        setInteractionAction("deleteConfirm");
      }
    },

    confirmDelete: async () => {
      if (activePane !== "tree") return;
      if (!treeCursorItem) {
        logger.error("No tree item selected during tree delete confirm");
        return;
      }

      if (treeCursorItem.type === "entry") {
        const res = await entryService.deleteEntry(treeCursorItem!.data.id);

        if (res instanceof Error) {
          logger.error("Failed to delete entry", res);
          setInteractionAction("idle");
          return;
        }
      } else if (treeCursorItem.type === "folder") {
        const res = await folderService.deleteFolder(treeCursorItem!.data.id);
        if (res instanceof Error) {
          logger.error("Failed to delete folder", res);
          return;
        }
      }

      setRefreshTreeItemTrigger();
      setActivePane("tree");
      setInteractionAction("idle");
    },
  };
};
