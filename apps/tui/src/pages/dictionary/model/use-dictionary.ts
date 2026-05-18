import { useState, useEffect } from "react";
import { useKeyboard } from "@opentui/react";

import {
  type CaptureService,
  type DirectoryService,
  DefinitionService,
  type Directory,
  type Capture,
} from "@dictos/core";

import { useDictionaryStore, useSelected } from "./use-dictionary-store";
import { useRenameLogic } from "./rename";

interface UseDictionaryProps {
  captureService: CaptureService;
  directoryService: DirectoryService;
  definitionService: DefinitionService;
}

export type TreeFocus = {
  pane: "tree";
  action: "idle" | "createInput" | "deleteConfirm" | "renameInput";
};

export type DefinitionFocus = {
  pane: "definition";
  action: "idle" | "createInput" | "deleteConfirm" | "renameInput";
};

export type FocusState = TreeFocus | DefinitionFocus;

interface DirectoryTreeItem {
  /** format: "dir-${dbId}" */
  id: string;
  type: "dir";
  data: Directory;
  label: string;
}

interface CaptureTreeItem {
  /** format: "capture-${dbId}" */
  id: string;
  type: "capture";
  data: Capture;
  label: string;
}

export type TreeItem = DirectoryTreeItem | CaptureTreeItem;

export const useDictionary = ({
  captureService,
  directoryService,
  definitionService,
}: UseDictionaryProps) => {
  // state
  const [pathStack, setPathStack] = useState<Directory[]>([]);

  // store
  const {
    inputValue,
    setInputValue,
    definitionsToDisplay,
    setDefinitionsToDisplay,
    treeItemsToDisplay,
    setTreeItemsToDisplay,
    focus,
    setFocus,
    selectedTreeItemIndex,
    setSelectedTreeItemIndex,
    setRefreshTreeItemTrigger,
    refreshTreeItemTrigger,
    definitionRefreshTrigger,
    setDefinitionRefreshTrigger,
  } = useDictionaryStore();

  const { selectedTreeItem, selectedDefinition } = useSelected();

  const { actionRequestRename } = useRenameLogic();

  // helper vars
  const currentDir = pathStack[pathStack.length - 1]!;
  const isAtRoot = pathStack.length === 1;

  // handlers
  const navigateInto = (selectedDir: Directory) => {
    setPathStack((prevStack) => [...prevStack, selectedDir]);
    setSelectedTreeItemIndex(0);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
    setSelectedTreeItemIndex(0);
  };

  const handleCreateSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setFocus({ pane: "tree", action: "idle" });
      return;
    }

    if (trimmed.endsWith("/")) {
      const name = trimmed.slice(0, -1);
      await directoryService
        .createDirectory({
          name: name,
          parentId: currentDir.id,
        })
        .catch(console.error);
    } else {
      await captureService
        .createCapture({ text: trimmed, directoryId: currentDir.id })
        .catch(console.error);
    }

    setRefreshTreeItemTrigger();
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDeleteTreeItemConfirm = async () => {
    if (selectedTreeItem!.type === "capture" && focus.pane === "tree") {
      await captureService
        .deleteCapture(selectedTreeItem!.data.id)
        .catch(console.error);
    } else if (selectedTreeItem!.type === "dir") {
      await directoryService
        .deleteDirectory(selectedTreeItem!.data.id)
        .catch(console.error);
    }

    setRefreshTreeItemTrigger();
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDeleteDefinitionConfirm = async () => {
    if (focus.pane === "definition") {
      await definitionService.deleteDefinition(selectedDefinition!.id);
      setDefinitionRefreshTrigger();
      setFocus({ pane: "definition", action: "idle" });
    }
  };

  const handleDeleteConfirmModalCancel = () => {
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDefinitionSubmit = async (finalText: string) => {
    const trimmed = finalText.trim();
    if (!trimmed || !selectedTreeItem) {
      setFocus({ pane: "definition", action: "idle" });
      return;
    }

    await definitionService.createDefinition({
      captureId: selectedTreeItem.data.id,
      text: trimmed,
    });

    setDefinitionRefreshTrigger();
    setFocus({ pane: "definition", action: "idle" });
  };

  // actions
  const actionRequestCreate = () => {
    setInputValue("");
    setFocus((prev) => ({ ...prev, action: "createInput" }));
  };

  const actionRequestDelete = () => {
    if (focus.pane === "tree" && treeItemsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }

    if (focus.pane === "definition" && definitionsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }
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

  return {
    pathStack,
    handleCreateSubmit,
    handleDeleteTreeItemConfirm,
    handleDeleteDefinitionConfirm,
    handleDeleteConfirmModalCancel,
    handleDefinitionSubmit,
  };
};
