import { useEffect, useState } from "react";

import {
  CaptureService,
  DirectoryService,
  type DirectoryNode,
  type Directory,
  type Capture,
} from "@dictos/core";

import { TreeSelect } from "./tree-select";
import { useKeyboard } from "@opentui/react";

interface DictionaryPageProps {
  captureService: CaptureService;
  directoryService: DirectoryService;
}

export interface TreeItem {
  type: "dir" | "capture";
  data: Directory | Capture;
  label: string;
}

export const DictionaryPage = ({
  captureService,
  directoryService,
}: DictionaryPageProps) => {
  const [pathStack, setPathStack] = useState<Directory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [itemsToDisplay, setItemsToDisplay] = useState<TreeItem[]>([]);

  const [focusMode, setFocusMode] = useState<"tree" | "createInput">("tree");
  const [inputValue, setInputValue] = useState<string>("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const currentDir = pathStack[pathStack.length - 1]!;
  const isAtRoot = pathStack.length === 1;

  const navigateInto = (selectedDirNode: DirectoryNode) => {
    setPathStack((prevStack) => [...prevStack, selectedDirNode]);
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

  const handleDeleteItem = async () => {
    if (itemsToDisplay.length === 0) return;

    const item = itemsToDisplay[selectedIndex]!;

    if (item.type === "capture") {
      await captureService.deleteCapture(item.data.id).catch(console.error);
    } else if (item.type === "dir") {
      await directoryService.deleteDirectory(item.data.id).catch(console.error);
    }

    setRefreshTrigger((prev) => prev + 1);
  };

  useKeyboard((key) => {
    if (focusMode === "createInput") {
      console.log("focusMode:", focusMode);
      if (key.name === "escape") {
        setFocusMode("tree");
      }

      return;
    }

    console.log("key.name:", key.name);
    console.log("selectedIndex:", selectedIndex);

    if (focusMode !== "tree") return;

    if (key.name === "a") {
      setInputValue("");
      setFocusMode("createInput");
    }

    if (key.name === "d") {
      handleDeleteItem();
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

      const item = itemsToDisplay[selectedIndex]!;
      if (item.type === "capture") return;

      navigateInto(item.data as DirectoryNode);
      setSelectedIndex(0);
    }

    if (key.name === "backspace" || key.name === "h" || key.name === "left") {
      navigateUp();
      setSelectedIndex(0);
    }
  });

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
          type: "dir",
          data: childDir,
          label: ` ${childDir.name}`,
        });
      }

      for (const capture of capturesResult) {
        items.push({
          type: "capture",
          data: capture,
          label: `${capture.text}`,
        });
      }

      setItemsToDisplay(items);
    };

    loadItems();
  }, [pathStack, refreshTrigger]);

  return (
    <box flexDirection="column">
      <box marginBottom={1}>
        <text fg="#22c55e">
          {pathStack
            .map((dir) => {
              if (pathStack.length > 1 && dir.name === "/") return;
              return dir.name;
            })
            .join("/")}
        </text>
      </box>
      {itemsToDisplay.length > 0 ? (
        <TreeSelect
          height={50}
          focused={focusMode === "tree"}
          items={itemsToDisplay}
          selectedIndex={selectedIndex}
        />
      ) : (
        <text>Loading or Empty...</text>
      )}

      {focusMode === "createInput" && (
        <box
          position="absolute"
          left="50%"
          top="12%"
          width="30%"
          height={3}
          border
          borderColor="#57534e"
          title="Create:"
          titleAlignment="left"
        >
          <input
            value={inputValue}
            onChange={setInputValue}
            // @ts-expect-error opentui type collision bug
            onSubmit={handleCreateSubmit}
            focused
          />
        </box>
      )}
    </box>
  );
};
