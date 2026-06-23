import { create } from "zustand";

import type {
  ActivePane,
  InteractionAction,
  PreviewPaneContent,
  TreeItem,
  TreeItemReference,
} from "./types";
import type { Description, Folder } from "@dictos/core";

type DictionaryStore = {
  inputValue: string;

  currentFolderItems: TreeItem[];
  activeEntryDescriptions: Description[];
  previewPaneContent: PreviewPaneContent;

  treeCursor: number;
  descriptionCursor: number;

  activeEntryId: string | null;
  activePane: ActivePane;
  interactionAction: InteractionAction;

  /**
   * Temporary target for a TreeItem context menu.
   *
   * Keep through rename/delete confirmation. Clear on close, success, or cancel.
   * Setting this must not select the item, move cursors, or open an Entry.
   */
  contextMenuTarget: TreeItemReference | null;
  /**
   * Temporary target for a Description context menu.
   *
   * Keep through rename/delete confirmation. Clear on close, success, or cancel.
   * Setting this must not select the item, move cursors, or open an Entry.
   */
  descriptionContextMenuTargetId: string | null;

  selectedTreeItems: TreeItemReference[];
  selectedDescriptionIds: string[];

  refreshTreeItemTrigger: number;
  descriptionRefreshTrigger: number;

  pathStack: Folder[];

  setInputValue: (newInputValue: string) => void;
  setActivePane: (newActivePane: ActivePane) => void;
  setInteractionAction: (newInteractionAction: InteractionAction) => void;
  setCurrentFolderItems: (newCurrentFolderItems: TreeItem[]) => void;
  setPreviewPaneContent: (newPreviewPaneContent: PreviewPaneContent) => void;
  setActiveEntryDescriptions: (newDescriptions: Description[]) => void;

  setTreeCursor: (
    newTreeItemIndex: number | ((prev: number) => number)
  ) => void;
  setDescriptionCursor: (
    newDescriptionIndex: number | ((prev: number) => number)
  ) => void;

  setActiveEntryId: (newActiveEntryId: string | null) => void;

  setSelectedTreeItems: (newSelectedTreeItems: TreeItemReference[]) => void;
  setContextMenuTarget: (
    newContextMenuTarget: TreeItemReference | null
  ) => void;
  setSelectedDescriptionIds: (newSelectedDescriptionIds: string[]) => void;
  setDescriptionContextMenuTargetId: (
    newDescriptionContextMenuTargetId: string | null
  ) => void;

  setRefreshTreeItemTrigger: () => void;
  setDescriptionRefreshTrigger: () => void;

  setPathStack: (
    newPathStack: Folder[] | ((prev: Folder[]) => Folder[])
  ) => void;
};

export const useDictionaryStore = create<DictionaryStore>((set) => ({
  inputValue: "",

  currentFolderItems: [],
  activeEntryDescriptions: [],
  previewPaneContent: { kind: "empty" },

  refreshTreeItemTrigger: 0,
  descriptionRefreshTrigger: 0,

  treeCursor: 0,
  descriptionCursor: 0,

  selectedTreeItems: [],
  contextMenuTarget: null,
  selectedDescriptionIds: [],
  descriptionContextMenuTargetId: null,

  activePane: "tree",
  interactionAction: "idle",
  activeEntryId: null,

  pathStack: [],

  setInputValue: (newInputValue) => {
    set({
      inputValue: newInputValue,
    });
  },

  setActivePane: (newActivePane) => {
    set({ activePane: newActivePane });
  },

  setInteractionAction: (newInteractionAction) => {
    set({ interactionAction: newInteractionAction });
  },

  setCurrentFolderItems: (newTreeItems) => {
    set({
      currentFolderItems: newTreeItems,
    });
  },

  setPreviewPaneContent: (newTreeItems) => {
    set({
      previewPaneContent: newTreeItems,
    });
  },

  setActiveEntryDescriptions: (newDescriptions) => {
    set({
      activeEntryDescriptions: newDescriptions,
    });
  },

  setTreeCursor: (newTreeItemIndex) => {
    set((state) => ({
      treeCursor:
        typeof newTreeItemIndex === "function"
          ? newTreeItemIndex(state.treeCursor)
          : newTreeItemIndex,
    }));
  },

  setDescriptionCursor: (newDescriptionIndex) => {
    set((state) => ({
      descriptionCursor:
        typeof newDescriptionIndex === "function"
          ? newDescriptionIndex(state.descriptionCursor)
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

  setActiveEntryId: (newActiveEntryId) => {
    set({ activeEntryId: newActiveEntryId });
  },

  setSelectedTreeItems: (newSelectedTreeItems) => {
    set({ selectedTreeItems: newSelectedTreeItems });
  },

  setContextMenuTarget: (newContextMenuTarget) => {
    set({ contextMenuTarget: newContextMenuTarget });
  },

  setSelectedDescriptionIds: (newSelectedDescriptionIds) => {
    set({ selectedDescriptionIds: newSelectedDescriptionIds });
  },

  setDescriptionContextMenuTargetId: (newDescriptionContextMenuTargetId) => {
    set({ descriptionContextMenuTargetId: newDescriptionContextMenuTargetId });
  },
}));
