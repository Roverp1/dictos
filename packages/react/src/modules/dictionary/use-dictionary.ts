import { useEffect } from "react";

import { useDictionaryStore } from "./use-dictionary-store";
import { useServices } from "../../providers";

import type { TreeItem } from "./types";
import { useTreeActions } from "./actions/use-tree-actions";
import { useNavigateActions } from "./actions/use-navigation-actions";
import { useDescriptionActions } from "./actions/use-description-actions";

export const useDictionary = () => {
  const { entryService, descriptionService, folderService, logger } =
    useServices();
  const { ...state } = useDictionaryStore();

  const navigationActions = useNavigateActions();
  const treeActions = useTreeActions();
  const descriptionActions = useDescriptionActions();

  const isAtRoot = state.pathStack.length === 1;
  const currentFolder = state.pathStack[state.pathStack.length - 1];
  const selectedTreeItem =
    state.treeItemsToDisplay[state.selectedTreeItemIndex];
  const selectedDescription =
    state.descriptionsToDisplay[state.selectedDescriptionIndex];

  // effects
  useEffect(() => {
    const onMount = async () => {
      const rootFolder = await folderService.getRootFolder();
      if (rootFolder instanceof Error) {
        logger.error("Failed to get root folder:", rootFolder);
        return;
      }

      state.setPathStack([rootFolder]);
    };

    onMount();
  }, [folderService, logger]);

  // Load Tree Items when Folder changes
  useEffect(() => {
    if (!currentFolder) return;

    const loadItems = async () => {
      const [foldersResult, entriesResult] = await Promise.all([
        folderService.getSubFolders(currentFolder.id),
        entryService.getEntriesInFolder(currentFolder.id),
      ]);

      if (foldersResult instanceof Error) {
        logger.error(
          "Failed to get sub-folders in current folder:",
          foldersResult
        );
        return;
      }
      if (entriesResult instanceof Error) {
        logger.error("Failed to get entries in current folder:", entriesResult);
        return;
      }

      const items: TreeItem[] = [];

      for (const childFolder of foldersResult) {
        items.push({
          id: `folder-${childFolder.id}`,
          type: "folder",
          data: childFolder,
          label: `${childFolder.name}`,
        });
      }

      for (const entry of entriesResult) {
        items.push({
          id: `entry-${entry.id}`,
          type: "entry",
          data: entry,
          label: `${entry.text}`,
        });
      }

      state.setTreeItemsToDisplay(items);
    };

    loadItems();
  }, [state.pathStack, state.refreshTreeItemTrigger]);

  // Load tree items on hover (for preview)
  useEffect(() => {
    if (selectedTreeItem?.type !== "folder") return;

    const loadItems = async () => {
      const [foldersResult, entriesResult] = await Promise.all([
        folderService.getSubFolders(selectedTreeItem.data.id),
        entryService.getEntriesInFolder(selectedTreeItem.data.id),
      ]);

      if (foldersResult instanceof Error) {
        logger.error(
          "Failed to get sub-folders in current folder:",
          foldersResult
        );
        return;
      }
      if (entriesResult instanceof Error) {
        logger.error("Failed to get entries in current folder:", entriesResult);
        return;
      }

      const items: TreeItem[] = [];

      for (const childFolder of foldersResult) {
        items.push({
          id: `folder-${childFolder.id}`,
          type: "folder",
          data: childFolder,
          label: `${childFolder.name}`,
        });
      }

      for (const entry of entriesResult) {
        items.push({
          id: `entry-${entry.id}`,
          type: "entry",
          data: entry,
          label: `${entry.text}`,
        });
      }

      state.setTreeItemsOnHoverToDisplay(items);
    };

    loadItems();
  }, [selectedTreeItem]);

  useEffect(() => {
    state.setSelectedTreeItemIndex((prev) => {
      if (state.treeItemsToDisplay.length === 0) return 0;

      return prev >= state.treeItemsToDisplay.length
        ? state.treeItemsToDisplay.length - 1
        : prev;
    });
  }, [state.treeItemsToDisplay]);

  // Load descriptions
  useEffect(() => {
    const loadDescriptions = async () => {
      if (!selectedTreeItem || selectedTreeItem.type !== "entry") return;

      const descriptions = await descriptionService.getDescriptionsForEntry(
        selectedTreeItem.data.id
      );
      if (descriptions instanceof Error) {
        logger.error("Failed to load descriptions.", descriptions);
        return;
      }

      state.setDescriptionsToDisplay(descriptions);
    };

    loadDescriptions();
  }, [state.selectedTreeItemIndex, state.descriptionRefreshTrigger]);

  const publicState = Object.freeze({
    inputValue: state.inputValue,
    focus: state.focus,
    treeItemsToDisplay: state.treeItemsToDisplay,
    treeItemsOnHoverToDisplay: state.treeItemsOnHoverToDisplay,
    descriptionsToDisplay: state.descriptionsToDisplay,
    selectedTreeItemIndex: state.selectedTreeItemIndex,
    selectedDescriptionIndex: state.selectedDescriptionIndex,
    refreshTreeItemTrigger: state.refreshTreeItemTrigger,
    descriptionRefreshTrigger: state.descriptionRefreshTrigger,
    pathStack: state.pathStack,
  });

  return {
    state: publicState,
    isAtRoot,
    selectedTreeItem,
    selectedDescription,
    currentFolder,
    actions: {
      tree: treeActions,
      description: descriptionActions,
      navigation: navigationActions,
      general: {
        cancelAction: () =>
          state.setFocus((prev) => ({ ...prev, action: "idle" })),

        updateInputValue: (val: string) => state.setInputValue(val),
      },
    },
  };
};
