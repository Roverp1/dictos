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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [itemsToDisplay, setItemsToDisplay] = useState<TreeItem[]>([]);

  const [defenitionIndex, setDefenitionIndex] = useState<number>(0);
  const [definitionsToDisplay, setDefinitionsToDisplay] = useState<
    Definition[]
  >([]);

  const [focus, setFocus] = useState<FocusState>({
    pane: "tree",
    action: "idle",
  });
  const [inputValue, setInputValue] = useState<string>("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [definitionRefreshTrigger, setDefinitionRefreshTrigger] = useState(0);

  // helper vars
  const currentDir = pathStack[pathStack.length - 1]!;
  const isAtRoot = pathStack.length === 1;
  const selectedItem = itemsToDisplay[selectedIndex];
  const selectedDefinition = definitionsToDisplay[defenitionIndex];

  // handlers
  const navigateInto = (selectedDir: Directory) => {
    setPathStack((prevStack) => [...prevStack, selectedDir]);
    setSelectedIndex(0);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
    setSelectedIndex(0);
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

    setRefreshTrigger((prev) => prev + 1);
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleRenameSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || !selectedItem) {
      setFocus({ pane: "tree", action: "idle" });
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
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDeleteTreeItemConfirm = async () => {
    if (selectedItem!.type === "capture" && focus.pane === "tree") {
      await captureService
        .deleteCapture(selectedItem!.data.id)
        .catch(console.error);
    } else if (selectedItem!.type === "dir") {
      await directoryService
        .deleteDirectory(selectedItem!.data.id)
        .catch(console.error);
    }

    setRefreshTrigger((prev) => prev + 1);
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDeleteDefenitionConfirm = async () => {
    if (focus.pane === "definition") {
      await definitionService.deleteDefinition(selectedDefinition!.id);
      setDefinitionRefreshTrigger((prev) => prev + 1);
      setFocus({ pane: "definition", action: "idle" });
    }
  };

  const handleDeleteConfirmModalCancel = () => {
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleDefinitionSubmit = async (finalText: string) => {
    const trimmed = finalText.trim();
    if (!trimmed || !selectedItem) {
      setFocus({ pane: "definition", action: "idle" });
      return;
    }

    await definitionService.createDefinition({
      captureId: selectedItem.data.id,
      text: trimmed,
    });

    setDefinitionRefreshTrigger((prev) => prev + 1);
    setFocus({ pane: "definition", action: "idle" });
  };

  // actions
  const actionRequestCreate = () => {
    setInputValue("");
    setFocus((prev) => ({ ...prev, action: "createInput" }));
  };

  const actionRequestDelete = () => {
    if (focus.pane === "tree" && itemsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }

    if (focus.pane === "definition" && definitionsToDisplay.length > 0) {
      setFocus((prev) => ({ ...prev, action: "deleteConfirm" }));
    }
  };

  const actionNavigateIn = () => {
    if (focus.pane === "tree" && selectedItem?.type === "dir") {
      navigateInto(selectedItem.data);
    } else if (focus.pane === "tree" && selectedItem?.type === "capture") {
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
      if (!selectedItem || selectedItem.type !== "capture") return;

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
  }, [selectedIndex, definitionRefreshTrigger]);

  return {
    itemsToDisplay,
    selectedIndex,
    setSelectedIndex,
    definitionsToDisplay,
    defenitionIndex,
    setDefenitionIndex,
    focus,
    setFocus,
    inputValue,
    setInputValue,
    pathStack,
    selectedItem,
    handleCreateSubmit,
    handleRenameSubmit,
    handleDeleteTreeItemConfirm,
    handleDeleteDefenitionConfirm,
    handleDeleteConfirmModalCancel,
    handleDefinitionSubmit,
    selectedDefinition,
  };
};
