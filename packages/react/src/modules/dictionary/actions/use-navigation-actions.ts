import type { Folder } from "@dictos/core";

import { useDictionaryStore } from "../use-dictionary-store";
import { useServices } from "../../../providers";

export const useNavigateActions = () => {
  const { logger } = useServices();
  const { focus, setFocus, setPathStack, setSelectedTreeItemIndex, ...state } =
    useDictionaryStore();

  const isAtRoot = state.pathStack.length === 1;
  const selectedTreeItem =
    state.treeItemsToDisplay[state.selectedTreeItemIndex];

  const navigateInto = (selectedFolder: Folder) => {
    setPathStack((prevStack) => [...prevStack, selectedFolder]);
    setSelectedTreeItemIndex(0);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
    setSelectedTreeItemIndex(0);
  };

  return {
    navigateIn: () => {
      if (focus.action !== "idle") return;

      if (!selectedTreeItem) {
        logger.error("No item selected during 'navigate in' action");
        return;
      }

      if (focus.pane === "tree" && selectedTreeItem.type === "folder") {
        navigateInto(selectedTreeItem.data);
      } else if (focus.pane === "tree" && selectedTreeItem.type === "entry") {
        setFocus({ pane: "description", action: "idle" });
      }
    },

    navigateOut: () => {
      if (focus.action !== "idle") return;

      if (focus.pane === "description") {
        setFocus({ pane: "tree", action: "idle" });
      } else if (focus.pane === "tree" && !isAtRoot) {
        navigateUp();
      }
    },

    moveSelectionDown: () => {
      if (focus.action !== "idle") return;

      if (focus.pane === "tree") {
        setSelectedTreeItemIndex((prev) => {
          const next =
            prev < state.treeItemsToDisplay.length - 1 ? prev + 1 : 0;
          return next;
        });
      } else if (focus.pane === "description") {
        state.setSelectedDescriptionIndex((prev) => {
          const length = state.descriptionsToDisplay.length;
          if (length === 0) return 0;
          const next =
            prev < state.descriptionsToDisplay.length - 1 ? prev + 1 : 0;
          return next;
        });
      }
    },

    moveSelectionUp: () => {
      if (focus.action !== "idle") return;

      if (focus.pane === "tree") {
        setSelectedTreeItemIndex((prev) => {
          const next =
            prev - 1 < 0 ? state.treeItemsToDisplay.length - 1 : prev - 1;
          return next;
        });
      } else if (focus.pane === "description") {
        state.setSelectedDescriptionIndex((prev) => {
          const length = state.descriptionsToDisplay.length;
          if (length === 0) return 0;
          const next = prev - 1 < 0 ? length - 1 : prev - 1;
          return next;
        });
      }
    },
  };
};
