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
  const treeCursorItem = state.currentFolderItems[state.treeCursor];
  const descriptionCursorItem =
    state.activeEntryDescriptions[state.descriptionCursor];

  // effects
  useEffect(() => {
    const onMount = async () => {
      if (state.pathStack.length > 0) return;
      const rootFolder = await folderService.getRootFolder();
      if (rootFolder instanceof Error) {
        logger.error("Failed to get root folder:", rootFolder);
        return;
      }

      state.setPathStack([rootFolder]);
    };

    onMount();
  }, [folderService, logger]);

  const loadTreeItemsForFolder = async (folderId: string) => {
    const [foldersResult, entriesResult] = await Promise.all([
      folderService.getSubFolders(folderId),
      entryService.getEntriesInFolder(folderId),
    ]);

    if (foldersResult instanceof Error) return foldersResult;
    if (entriesResult instanceof Error) return entriesResult;

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

    return items;
  };

  const loadDescriptionsForEntry = async (entryId: string) => {
    const descriptions =
      await descriptionService.getDescriptionsForEntry(entryId);

    if (descriptions instanceof Error) return descriptions;
    return descriptions;
  };

  // Load Tree Items when Folder changes
  useEffect(() => {
    if (!currentFolder) return;

    const loadItems = async () => {
      const items = await loadTreeItemsForFolder(currentFolder.id);

      if (items instanceof Error) {
        logger.error("Failed to load current folder items.", items);
        return;
      }

      state.setCurrentFolderItems(items);
    };

    loadItems();
  }, [state.pathStack, state.refreshTreeItemTrigger]);

  // Load preview pane content from the tree cursor
  useEffect(() => {
    if (state.activeEntryId !== null) {
      state.setPreviewPaneContent({ kind: "empty" });
      return;
    }

    if (!treeCursorItem) {
      state.setPreviewPaneContent({ kind: "empty" });
      return;
    }

    const loadPreview = async () => {
      if (treeCursorItem.type === "folder") {
        const items = await loadTreeItemsForFolder(treeCursorItem.data.id);

        if (items instanceof Error) {
          logger.error("Failed to load current folder items.", items);
          return;
        }

        state.setPreviewPaneContent({
          kind: "folder",
          folderId: treeCursorItem.data.id,
          items: items,
        });

        return;
      }

      const descriptions = await loadDescriptionsForEntry(
        treeCursorItem.data.id
      );

      if (descriptions instanceof Error) {
        logger.error("Failed to load Entry preview.", descriptions);
        return;
      }

      state.setPreviewPaneContent({
        kind: "entry",
        entryId: treeCursorItem.data.id,
        descriptions,
      });
    };

    loadPreview();
  }, [
    state.activeEntryId,
    state.currentFolderItems,
    state.treeCursor,
    state.descriptionRefreshTrigger,
  ]);

  useEffect(() => {
    state.setTreeCursor((prev) => {
      if (state.currentFolderItems.length === 0) return 0;

      return prev >= state.currentFolderItems.length
        ? state.currentFolderItems.length - 1
        : prev;
    });
  }, [state.currentFolderItems]);

  // Load active Entry descriptions
  useEffect(() => {
    const entryId = state.activeEntryId;

    if (entryId === null) {
      state.setActiveEntryDescriptions([]);
      return;
    }

    const loadActiveDescriptions = async () => {
      state.setActiveEntryDescriptions([]);

      const descriptions = await loadDescriptionsForEntry(entryId);

      if (descriptions instanceof Error) {
        logger.error("Failed to load active Entry descriptions.", descriptions);
        return;
      }

      state.setActiveEntryDescriptions(descriptions);
    };

    loadActiveDescriptions();
  }, [state.activeEntryId, state.descriptionRefreshTrigger]);

  const publicState = Object.freeze({
    inputValue: state.inputValue,

    currentFolderItems: state.currentFolderItems,
    activeEntryDescriptions: state.activeEntryDescriptions,
    previewPaneContent: state.previewPaneContent,

    activePane: state.activePane,
    activeEntryId: state.activeEntryId,
    interactionAction: state.interactionAction,
    pathStack: state.pathStack,

    treeCursor: state.treeCursor,
    descriptionCursor: state.descriptionCursor,

    selectedTreeItems: state.selectedTreeItems,
    contextMenuTarget: state.contextMenuTarget,
    selectedDescriptionIds: state.selectedDescriptionIds,
    descriptionContextMenuTargetId: state.descriptionContextMenuTargetId,

    refreshTreeItemTrigger: state.refreshTreeItemTrigger,
    descriptionRefreshTrigger: state.descriptionRefreshTrigger,
  });

  return {
    state: publicState,
    isAtRoot,
    treeCursorItem,
    descriptionCursorItem,
    currentFolder,
    actions: {
      tree: treeActions,
      description: descriptionActions,
      navigation: navigationActions,
      general: {
        cancelAction: () => state.setInteractionAction("idle"),

        updateInputValue: (val: string) => state.setInputValue(val),
      },
    },
  };
};
