import { create } from "zustand";
import type { SetStateAction } from "react";

import type { FocusState, TreeItem } from "./types";
import type { Description, Folder } from "@dictos/core";

type DictionaryStore = {
  inputValue: string;
  focus: FocusState;
  treeItemsToDisplay: TreeItem[];
  treeItemsOnHoverToDisplay: TreeItem[];
  descriptionsToDisplay: Description[];
  selectedTreeItemIndex: number;
  selectedDescriptionIndex: number;
  refreshTreeItemTrigger: number;
  descriptionRefreshTrigger: number;
  pathStack: Folder[];

  setInputValue: (newInputValue: string) => void;
  setFocus: (
    newFocusValue: FocusState | ((prev: FocusState) => FocusState)
  ) => void;
  setTreeItemsToDisplay: (newTreeItems: TreeItem[]) => void;
  setTreeItemsOnHoverToDisplay: (newTreeItems: TreeItem[]) => void;
  setDescriptionsToDisplay: (newDescriptionsValue: Description[]) => void;
  setSelectedTreeItemIndex: (
    newTreeItemIndex: number | SetStateAction<number>
  ) => void;
  setSelectedDescriptionIndex: (
    newDescriptionIndex: number | SetStateAction<number>
  ) => void;
  setRefreshTreeItemTrigger: () => void;
  setDescriptionRefreshTrigger: () => void;
  setPathStack: (newPathStack: Folder[] | SetStateAction<Folder[]>) => void;
};

export const useDictionaryStore = create<DictionaryStore>((set, get) => ({
  inputValue: "",
  focus: {
    pane: "tree",
    action: "idle",
  } as FocusState,
  treeItemsToDisplay: [],
  treeItemsOnHoverToDisplay: [],
  descriptionsToDisplay: [],
  selectedTreeItemIndex: 0,
  selectedDescriptionIndex: 0,
  refreshTreeItemTrigger: 0,
  descriptionRefreshTrigger: 0,
  pathStack: [],

  setInputValue: (newInputValue) => {
    set({
      inputValue: newInputValue,
    });
  },

  setFocus: (newFocusValue) => {
    set((state) => ({
      focus:
        typeof newFocusValue === "function"
          ? newFocusValue(state.focus)
          : newFocusValue,
    }));
  },

  setTreeItemsToDisplay: (newTreeItems) => {
    set({
      treeItemsToDisplay: newTreeItems,
    });
  },

  setTreeItemsOnHoverToDisplay: (newTreeItems) => {
    set({
      treeItemsOnHoverToDisplay: newTreeItems,
    });
  },

  setDescriptionsToDisplay: (newDescriptionsValue) => {
    set({
      descriptionsToDisplay: newDescriptionsValue,
    });
  },

  setSelectedTreeItemIndex: (newTreeItemIndex) => {
    set((state) => ({
      selectedTreeItemIndex:
        typeof newTreeItemIndex === "function"
          ? newTreeItemIndex(state.selectedTreeItemIndex)
          : newTreeItemIndex,
    }));
  },

  setSelectedDescriptionIndex: (newDescriptionIndex) => {
    set((state) => ({
      selectedDescriptionIndex:
        typeof newDescriptionIndex === "function"
          ? newDescriptionIndex(state.selectedDescriptionIndex)
          : newDescriptionIndex,
    }));
  },

  setRefreshTreeItemTrigger: () => {
    set((state) => ({
      refreshTreeItemTrigger: state.refreshTreeItemTrigger + 1,
    }));
  },

  setDescriptionRefreshTrigger: () => {
    set((state) => ({
      descriptionRefreshTrigger: state.descriptionRefreshTrigger + 1,
    }));
  },

  setPathStack: (newPathStack) => {
    set((state) => ({
      pathStack:
        typeof newPathStack === "function"
          ? newPathStack(state.pathStack)
          : newPathStack,
    }));
  },
}));

export const useHelperVariables = () => {
  const selectedTreeItem = useDictionaryStore(
    (state) => state.treeItemsToDisplay[state.selectedTreeItemIndex]
  );

  const selectedDescription = useDictionaryStore(
    (state) => state.descriptionsToDisplay[state.selectedDescriptionIndex]
  );

  const currentFolder = useDictionaryStore(
    (state) => state.pathStack[state.pathStack.length - 1]
  );

  const isAtRoot = useDictionaryStore((state) => state.pathStack.length === 1);

  return { selectedTreeItem, selectedDescription, currentFolder, isAtRoot };
};
