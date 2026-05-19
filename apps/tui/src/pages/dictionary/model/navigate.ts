import type { Directory } from "@dictos/core";
import { useDictionaryStore, useHelperVariables } from "./use-dictionary-store";

export const useNavigateLogic = () => {
  const { focus, setFocus, setPathStack, setSelectedTreeItemIndex } =
    useDictionaryStore();

  const { selectedTreeItem, isAtRoot } = useHelperVariables();

  const navigateInto = (selectedDir: Directory) => {
    setPathStack((prevStack) => [...prevStack, selectedDir]);
    setSelectedTreeItemIndex(0);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
    setSelectedTreeItemIndex(0);
  };

  const actionNavigateIn = () => {
    if (focus.pane === "tree" && selectedTreeItem?.type === "dir") {
      navigateInto(selectedTreeItem.data);
    } else if (focus.pane === "tree" && selectedTreeItem?.type === "capture") {
      setFocus({ pane: "definition", action: "idle" });
    }
  };

  const actionNavigateOut = () => {
    if (focus.pane === "definition") {
      setFocus({ pane: "tree", action: "idle" });
    } else if (focus.pane === "tree" && !isAtRoot) {
      navigateUp();
    }
  };

  return { actionNavigateIn, actionNavigateOut, navigateInto, navigateUp };
};
