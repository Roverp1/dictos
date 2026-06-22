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
    contextMenuTarget,
    setInputValue,
    setActivePane,
    setInteractionAction,
    setRefreshTreeItemTrigger,
    setContextMenuTarget,
  } = useDictionaryStore();

  const currentFolder = pathStack[pathStack.length - 1];
  const treeCursorItem = currentFolderItems[treeCursor];

  // helpers
  const getSingleTreeTarget = () => {
    if (!contextMenuTarget) return treeCursorItem ?? null;

    return (
      currentFolderItems.find(
        (item) =>
          item.type === contextMenuTarget.type &&
          item.data.id === contextMenuTarget.id
      ) ?? null
    );
  };

  const finishAction = () => {
    setRefreshTreeItemTrigger();
    setContextMenuTarget(null);
    setActivePane("tree");
    setInteractionAction("idle");
  };

  // actions
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

      finishAction();
    },

    requestRename: () => {
      const targetItem = getSingleTreeTarget();

      if (
        activePane === "tree" &&
        interactionAction === "idle" &&
        currentFolderItems.length > 0 &&
        targetItem
      ) {
        setActivePane("tree");
        setInteractionAction("renameInput");

        if (targetItem.type === "folder") {
          setInputValue(targetItem.data.name);
        } else if (targetItem.type === "entry") {
          setInputValue(targetItem.data.text);
        }
      }
    },

    submitRename: async (val: string) => {
      if (interactionAction === "renameInput" && activePane === "tree") {
        const trimmed = val.trim();
        if (!trimmed) {
          setContextMenuTarget(null);
          setInteractionAction("idle");
          return;
        }

        const targetItem = getSingleTreeTarget();
        if (!targetItem) {
          logger.error("No targetItem found during tree rename submit");
          return;
        }

        if (targetItem.type === "folder") {
          const res = await folderService.renameFolder(
            targetItem.data.id,
            trimmed
          );
          if (res instanceof Error) {
            logger.error("Failed to rename folder", res);
            return;
          }
        } else {
          const res = await entryService.updateEntry(targetItem.data.id, {
            text: trimmed,
          });
          if (res instanceof Error) {
            logger.error("Failed to rename entry", res);
            return;
          }
        }

        finishAction();
      }
    },

    requestDelete: () => {
      const targetItem = getSingleTreeTarget();

      if (activePane === "tree" && interactionAction === "idle" && targetItem) {
        setActivePane("tree");
        setInteractionAction("deleteConfirm");
      }
    },

    confirmDelete: async () => {
      if (activePane !== "tree") return;

      const targetItem = getSingleTreeTarget();
      if (!targetItem) {
        logger.error("No targetItem found during tree delete confirm");
        return;
      }

      if (targetItem.type === "entry") {
        const res = await entryService.deleteEntry(targetItem.data.id);

        if (res instanceof Error) {
          logger.error("Failed to delete entry", res);
          setInteractionAction("idle");
          setContextMenuTarget(null);
          return;
        }
      } else if (targetItem.type === "folder") {
        const res = await folderService.deleteFolder(targetItem.data.id);
        if (res instanceof Error) {
          logger.error("Failed to delete folder", res);
          setInteractionAction("idle");
          setContextMenuTarget(null);
          return;
        }
      }

      finishAction();
    },
  };
};
