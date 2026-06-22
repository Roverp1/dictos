import type { Folder } from "@dictos/core";

import { useDictionaryStore } from "../use-dictionary-store";
import { useServices } from "../../../providers";

export const useNavigateActions = () => {
  const { logger } = useServices();
  const {
    activePane,
    interactionAction,
    setActivePane,
    setActiveEntryId,
    setDescriptionCursor,
    setInteractionAction,
    setPathStack,
    setTreeCursor,
    ...state
  } = useDictionaryStore();

  const isAtRoot = state.pathStack.length === 1;
  const treeCursorItem = state.currentFolderItems[state.treeCursor];

  const navigateInto = (selectedFolder: Folder) => {
    setPathStack((prevStack) => [...prevStack, selectedFolder]);
    setTreeCursor(0);
    setActiveEntryId(null);
    setActivePane("tree");
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
    setTreeCursor(0);
    setActiveEntryId(null);
    setActivePane("tree");
  };

  const openEntry = (entryId: string) => {
    const nextTreeCursor = state.currentFolderItems.findIndex(
      (item) => item.type === "entry" && item.data.id === entryId
    );

    if (nextTreeCursor !== -1) {
      setTreeCursor(nextTreeCursor);
    }

    setActiveEntryId(entryId);
    setActivePane("description");
    setDescriptionCursor(0);
  };

  const closeEntry = () => {
    setActivePane("tree");
    setActiveEntryId(null);
    setInteractionAction("idle");
    setDescriptionCursor(0);
  };

  return {
    openEntry,
    closeEntry,

    navigateIn: () => {
      if (interactionAction !== "idle") return;
      if (activePane !== "tree") return;

      if (!treeCursorItem) {
        logger.error("No item selected during 'navigate in' action");
        return;
      }

      if (treeCursorItem.type === "folder") {
        navigateInto(treeCursorItem.data);
        return;
      }

      openEntry(treeCursorItem.data.id);
    },

    navigateOut: () => {
      if (interactionAction !== "idle") return;

      if (activePane === "description") {
        closeEntry();
        return;
      }

      if (!isAtRoot) {
        navigateUp();
      }
    },

    moveCursor: (direction: "up" | "down") => {
      if (interactionAction !== "idle") return;
      if (activePane === "tree") {
        setTreeCursor((prev) => {
          const length = state.currentFolderItems.length;
          if (length === 0) return 0;

          if (direction === "down") {
            return prev < length - 1 ? prev + 1 : 0;
          }

          return prev - 1 < 0 ? length - 1 : prev - 1;
        });

        return;
      }

      setDescriptionCursor((prev) => {
        const length = state.activeEntryDescriptions.length;
        if (length === 0) return 0;

        if (direction === "down") {
          return prev < length - 1 ? prev + 1 : 0;
        }

        return prev - 1 < 0 ? length - 1 : prev - 1;
      });
    },
  };
};
