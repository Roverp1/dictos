import { create } from "zustand";
import type { SetStateAction } from "react";

import type { FocusState, TreeItem } from "./types";
import type { Definition, Directory } from "@dictos/core";

type DictionaryStore = {
  inputValue: string;
  focus: FocusState;
  treeItemsToDisplay: TreeItem[];
  definitionsToDisplay: Definition[];
  selectedTreeItemIndex: number;
  selectedDefinitionIndex: number;
  refreshTreeItemTrigger: number;
  definitionRefreshTrigger: number;
  pathStack: Directory[];

  setInputValue: (newInputValue: string) => void;
  setFocus: (
    newFocusValue: FocusState | ((prev: FocusState) => FocusState)
  ) => void;
  setTreeItemsToDisplay: (newTreeItems: TreeItem[]) => void;
  setDefinitionsToDisplay: (newDefinitionsValue: Definition[]) => void;
  setSelectedTreeItemIndex: (
    newTreeItemIndex: number | SetStateAction<number>
  ) => void;
  setSelectedDefinitionIndex: (
    newDefinitionIndex: number | SetStateAction<number>
  ) => void;
  setRefreshTreeItemTrigger: () => void;
  setDefinitionRefreshTrigger: () => void;
  setPathStack: (
    newPathStack: Directory[] | SetStateAction<Directory[]>
  ) => void;
};

export const useDictionaryStore = create<DictionaryStore>((set, get) => ({
  inputValue: "",
  focus: {
    pane: "tree",
    action: "idle",
  } as FocusState,
  treeItemsToDisplay: [],
  definitionsToDisplay: [],
  selectedTreeItemIndex: 0,
  selectedDefinitionIndex: 0,
  refreshTreeItemTrigger: 0,
  definitionRefreshTrigger: 0,
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

  setDefinitionsToDisplay: (newDefinitionsValue) => {
    set({
      definitionsToDisplay: newDefinitionsValue,
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

  setSelectedDefinitionIndex: (newDefinitionIndex) => {
    set((state) => ({
      selectedDefinitionIndex:
        typeof newDefinitionIndex === "function"
          ? newDefinitionIndex(state.selectedDefinitionIndex)
          : newDefinitionIndex,
    }));
  },

  setRefreshTreeItemTrigger: () => {
    set((state) => ({
      refreshTreeItemTrigger: state.refreshTreeItemTrigger + 1,
    }));
  },

  setDefinitionRefreshTrigger: () => {
    set((state) => ({
      definitionRefreshTrigger: state.definitionRefreshTrigger + 1,
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

export const useSelected = () => {
  const selectedTreeItem = useDictionaryStore(
    (state) => state.treeItemsToDisplay[state.selectedTreeItemIndex]
  );

  const selectedDefinition = useDictionaryStore(
    (state) => state.definitionsToDisplay[state.selectedDefinitionIndex]
  );

  const currentDir = useDictionaryStore(
    (state) => state.pathStack[state.pathStack.length - 1]!
  );

  const isAtRoot = useDictionaryStore((state) => state.pathStack.length === 1);

  return { selectedTreeItem, selectedDefinition, currentDir, isAtRoot };
};
