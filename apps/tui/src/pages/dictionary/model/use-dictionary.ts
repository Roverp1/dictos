import { useState, useEffect } from "react";
import { useKeyboard } from "@opentui/react";

import {
  type CaptureService,
  type DirectoryService,
  DefinitionService,
  type Directory,
  type Capture,
  type Definition,
} from "@dictos/core";

interface UseDictionaryProps {
  captureService: CaptureService;
  directoryService: DirectoryService;
  definitionService: DefinitionService;
}

export type FocusMode =
  | "tree"
  | "createInput"
  | "deleteConfimModal"
  | "renameTreeItem"
  | "definitionPane";

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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [itemsToDisplay, setItemsToDisplay] = useState<TreeItem[]>([]);

  const [definitionsToDisplay, setDefinitionsToDisplay] = useState<
    Definition[]
  >([]);

  const [focusMode, setFocusMode] = useState<FocusMode>("tree");
  const [inputValue, setInputValue] = useState<string>("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // helper vars
  const currentDir = pathStack[pathStack.length - 1]!;
  const isAtRoot = pathStack.length === 1;
  const selectedItem = itemsToDisplay[selectedIndex];

  // actions
  const navigateInto = (selectedDir: Directory) => {
    setPathStack((prevStack) => [...prevStack, selectedDir]);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
  };

  const handleCreateSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setFocusMode("tree");
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

    setRefreshTrigger((prev) => prev + 1);
    setFocusMode("tree");
  };

  const handleRenameSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || !selectedItem) {
      setFocusMode("tree");
      return;
    }

    if (selectedItem.type === "dir") {
      await directoryService
        .renameDirectory(selectedItem.data.id, trimmed)
        .catch(console.error);
    } else {
      await captureService
        .updateCapture(selectedItem.data.id, { text: trimmed })
        .catch(console.error);
    }

    setRefreshTrigger((prev) => prev + 1);
    setFocusMode("tree");
  };

  const handleDeleteConfirmModalConfirm = async () => {
    if (selectedItem!.type === "capture") {
      await captureService
        .deleteCapture(selectedItem!.data.id)
        .catch(console.error);
    } else if (selectedItem!.type === "dir") {
      await directoryService
        .deleteDirectory(selectedItem!.data.id)
        .catch(console.error);
    }

    setRefreshTrigger((prev) => prev + 1);
    setFocusMode("tree");
  };
  useEffect(() => {
    console.log("selectedIndex", selectedIndex);
    console.log("itemsToDisplay.length", itemsToDisplay.length);
  }, [selectedIndex]);

  const handleDeleteConfirmModalCancel = () => {
    setFocusMode("tree");
  };

  // keyboard logic
  useKeyboard((key) => {
    if (focusMode !== "tree") {
      if (key.name === "escape") {
        setFocusMode("tree");
      }

      return;
    }

    console.log("key.name:", key.name);

    if (focusMode === "tree") {
      if (key.name === "a") {
        setInputValue("");
        setFocusMode("createInput");
      }

      if (key.name === "d") {
        setFocusMode("deleteConfimModal");
      }

      if (key.name === "r") {
        if (itemsToDisplay.length === 0 || !selectedItem) return;

        const rawName =
          selectedItem.type === "dir"
            ? selectedItem.data.name
            : selectedItem.data.text;

        setInputValue(rawName);
        setFocusMode("renameTreeItem");
      }

      if (key.name === "j" || key.name === "down") {
        setSelectedIndex((prev) => {
          if (prev + 1 >= itemsToDisplay.length) return 0;

          return prev + 1;
        });
      }

      if (key.name === "k" || key.name === "up") {
        setSelectedIndex((prev) => {
          if (itemsToDisplay.length === 0) return 0;
          if (prev - 1 < 0) return itemsToDisplay.length - 1;

          return prev - 1;
        });
      }

      if (key.name === "return" || key.name === "l" || key.name === "right") {
        if (itemsToDisplay.length === 0) return;

        if (selectedItem!.type === "capture") {
          setFocusMode("definitionPane");
        } else if (selectedItem!.type === "dir") {
          navigateInto(selectedItem!.data);
          setSelectedIndex(0);
        }
      }

      if (key.name === "backspace" || key.name === "h" || key.name === "left") {
        navigateUp();
        setSelectedIndex(0);
      }
    }
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

      setItemsToDisplay(items);
    };

    loadItems();
  }, [pathStack, refreshTrigger]);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (itemsToDisplay.length === 0) return 0;

      return prev >= itemsToDisplay.length ? itemsToDisplay.length - 1 : prev;
    });
  }, [itemsToDisplay]);

  useEffect(() => {
    const loadDefinitions = async () => {
      if (!selectedItem) return;

      const definitions = await definitionService.getDefintionsForCapture(
        selectedItem.data.id
      );
      if (definitions instanceof Error) {
        console.error(definitions);
        return;
      }

      setDefinitionsToDisplay(definitions);
    };

    loadDefinitions();
  }, [selectedIndex]);

  return {
    itemsToDisplay,
    definitionsToDisplay,
    focusMode,
    inputValue,
    setInputValue,
    pathStack,
    selectedIndex,
    selectedItem,
    handleCreateSubmit,
    handleRenameSubmit,
    handleDeleteConfirmModalConfirm,
    handleDeleteConfirmModalCancel,
  };
};
