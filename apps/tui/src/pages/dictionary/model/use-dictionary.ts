import { useEffect } from "react";
import { useKeyboard } from "@opentui/react";

import { useDictionaryStore, useSelected } from "./use-dictionary-store";
import { useServices } from "@shared/lib/services";
import { useRenameLogic } from "./rename";
import { useCreateLogic } from "./create";
import { useDeleteLogic } from "./delete";
import { useNavigateLogic } from "./navigate";

import type { TreeItem } from "./types";

export const useDictionary = () => {
  // store
  const {
    setDefinitionsToDisplay,
    treeItemsToDisplay,
    setTreeItemsToDisplay,
    focus,
    setFocus,
    selectedTreeItemIndex,
    setSelectedTreeItemIndex,
    refreshTreeItemTrigger,
    definitionRefreshTrigger,
    pathStack,
    setPathStack,
  } = useDictionaryStore();

  const { selectedTreeItem, currentDir } = useSelected();

  const { captureService, definitionService, directoryService } = useServices();

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
      const rootDir = await directoryService.getRootDirectory();
      if (rootDir instanceof Error) {
        console.error("Failed to get root directory:", rootDir);
        return;
      }

      setPathStack([rootDir]);
    };

    onMount();
  }, [directoryService]);

  useEffect(() => {
    if (!currentDir) return;

    const loadItems = async () => {
      const [dirsResult, capturesResult] = await Promise.all([
        directoryService.getSubDirectories(currentDir.id),
        captureService.getCapturesInDirectory(currentDir.id),
      ]);

      if (dirsResult instanceof Error) {
        console.error(
          "Failed to get sub-directories in current directory:",
          dirsResult
        );
        return;
      }
      if (capturesResult instanceof Error) {
        console.error(
          "Failed to get captures in current directory:",
          capturesResult
        );
        return;
      }

      const items: TreeItem[] = [];

      for (const childDir of dirsResult) {
        items.push({
          id: `dir-${childDir.id}`,
          type: "dir",
          data: childDir,
          label: ` ${childDir.name}`,
        });
      }

      for (const capture of capturesResult) {
        items.push({
          id: `capture-${capture.id}`,
          type: "capture",
          data: capture,
          label: `${capture.text}`,
        });
      }

      setTreeItemsToDisplay(items);
    };

    loadItems();
  }, [pathStack, refreshTreeItemTrigger]);

  useEffect(() => {
    setSelectedTreeItemIndex((prev) => {
      if (treeItemsToDisplay.length === 0) return 0;

      return prev >= treeItemsToDisplay.length
        ? treeItemsToDisplay.length - 1
        : prev;
    });
  }, [treeItemsToDisplay]);

  useEffect(() => {
    const loadDefinitions = async () => {
      if (!selectedTreeItem || selectedTreeItem.type !== "capture") return;

      const definitions = await definitionService.getDefintionsForCapture(
        selectedTreeItem.data.id
      );
      if (definitions instanceof Error) {
        console.error(definitions);
        return;
      }

      setDefinitionsToDisplay(definitions);
    };

    loadDefinitions();
  }, [selectedTreeItemIndex, definitionRefreshTrigger]);
};
