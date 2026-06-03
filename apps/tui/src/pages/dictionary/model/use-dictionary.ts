import { useEffect } from "react";
import { useKeyboard } from "@opentui/react";

import { useDictionaryStore, useHelperVariables } from "./use-dictionary-store";
import { useServices } from "@shared/lib/services";
import { useRenameLogic } from "./rename";
import { useCreateLogic } from "./create";
import { useDeleteLogic } from "./delete";
import { useNavigateLogic } from "./navigate";

import type { TreeItem } from "./types";

export const useDictionary = () => {
  // store
  const {
    setDescriptionsToDisplay,
    treeItemsToDisplay,
    setTreeItemsToDisplay,
    focus,
    setFocus,
    selectedTreeItemIndex,
    setSelectedTreeItemIndex,
    refreshTreeItemTrigger,
    descriptionRefreshTrigger,
    pathStack,
    setPathStack,
    setTreeItemsOnHoverToDisplay,
    treeItemsOnHoverToDisplay,
  } = useDictionaryStore();

  const { selectedTreeItem, currentFolder } = useHelperVariables();

  const { entryService, descriptionService, folderService } = useServices();

  const { actionRequestRename } = useRenameLogic();
  const { actionRequestCreate } = useCreateLogic();
  const { actionRequestDelete } = useDeleteLogic();
  const { actionNavigateIn, actionNavigateOut } = useNavigateLogic();

  // keyboard logic
  useKeyboard((key) => {
    if (focus.action !== "idle") {
      if (key.name === "escape") {
        setFocus((prev) => ({ ...prev, action: "idle" }));
      }

      return;
    }

    console.log("key.name:", key.name);

    if (key.name === "a") actionRequestCreate();
    if (key.name === "d") actionRequestDelete();

    if (key.name === "r") actionRequestRename();

    if (key.name === "return" || key.name === "l" || key.name === "right")
      actionNavigateIn();
    if (key.name === "backspace" || key.name === "h" || key.name === "left")
      actionNavigateOut();
  });

  // effects
  useEffect(() => {
    const onMount = async () => {
      const rootFolder = await folderService.getRootFolder();
      if (rootFolder instanceof Error) {
        console.error("Failed to get root folder:", rootFolder);
        return;
      }
      console.log("rootFolder: ", rootFolder);

      setPathStack([rootFolder]);
    };

    onMount();
  }, [folderService]);

  useEffect(() => {
    if (!currentFolder) return;

    const loadItems = async () => {
      const [foldersResult, entriesResult] = await Promise.all([
        folderService.getSubFolders(currentFolder.id),
        entryService.getEntriesInFolder(currentFolder.id),
      ]);

      if (foldersResult instanceof Error) {
        console.error(
          "Failed to get sub-folders in current folder:",
          foldersResult
        );
        return;
      }
      if (entriesResult instanceof Error) {
        console.error(
          "Failed to get entries in current folder:",
          entriesResult
        );
        return;
      }

      const items: TreeItem[] = [];

      for (const childFolder of foldersResult) {
        items.push({
          id: `folder-${childFolder.id}`,
          type: "folder",
          data: childFolder,
          label: ` ${childFolder.name}`,
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

      setTreeItemsToDisplay(items);
    };

    loadItems();
  }, [pathStack, refreshTreeItemTrigger]);

  useEffect(() => {
    if (selectedTreeItem?.type !== "folder") return;

    const loadItems = async () => {
      const [foldersResult, entriesResult] = await Promise.all([
        folderService.getSubFolders(selectedTreeItem.data.id),
        entryService.getEntriesInFolder(selectedTreeItem.data.id),
      ]);

      if (foldersResult instanceof Error) {
        console.error(
          "Failed to get sub-folders in current folder:",
          foldersResult
        );
        return;
      }
      if (entriesResult instanceof Error) {
        console.error(
          "Failed to get entries in current folder:",
          entriesResult
        );
        return;
      }

      const items: TreeItem[] = [];

      for (const childFolder of foldersResult) {
        items.push({
          id: `folder-${childFolder.id}`,
          type: "folder",
          data: childFolder,
          label: ` ${childFolder.name}`,
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

      setTreeItemsOnHoverToDisplay(items);
    };

    loadItems();
  }, [selectedTreeItem]);

  useEffect(() => {
    setSelectedTreeItemIndex((prev) => {
      if (treeItemsToDisplay.length === 0) return 0;

      return prev >= treeItemsToDisplay.length
        ? treeItemsToDisplay.length - 1
        : prev;
    });
  }, [treeItemsToDisplay]);

  useEffect(() => {
    const loadDescriptions = async () => {
      if (!selectedTreeItem || selectedTreeItem.type !== "entry") return;

      const descriptions = await descriptionService.getDescriptionsForEntry(
        selectedTreeItem.data.id
      );
      if (descriptions instanceof Error) {
        console.error(descriptions);
        return;
      }

      setDescriptionsToDisplay(descriptions);
    };

    loadDescriptions();
  }, [selectedTreeItemIndex, descriptionRefreshTrigger]);
};
