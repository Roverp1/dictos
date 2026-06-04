import type { Folder } from "@dictos/core";

import { useDictionaryStore, useHelperVariables } from "@entities/dictionary";

export const useNavigateLogic = () => {
  const { focus, setFocus, setPathStack, setSelectedTreeItemIndex } =
    useDictionaryStore();

  const { selectedTreeItem, isAtRoot } = useHelperVariables();

  const navigateInto = (selectedFolder: Folder) => {
    setPathStack((prevStack) => [...prevStack, selectedFolder]);
    setSelectedTreeItemIndex(0);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
    setSelectedTreeItemIndex(0);
  };

  const actionNavigateIn = () => {
    if (focus.pane === "tree" && selectedTreeItem?.type === "folder") {
      navigateInto(selectedTreeItem.data);
    } else if (focus.pane === "tree" && selectedTreeItem?.type === "entry") {
      setFocus({ pane: "description", action: "idle" });
    }
  };

  const actionNavigateOut = () => {
    if (focus.pane === "description") {
      setFocus({ pane: "tree", action: "idle" });
    } else if (focus.pane === "tree" && !isAtRoot) {
      navigateUp();
    }
  };

  return { actionNavigateIn, actionNavigateOut, navigateInto, navigateUp };
};
