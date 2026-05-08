import { useEffect, useRef, useState } from "react";

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
  data: DirectoryNode | Capture;
  label: string;
}

export const DictionaryPage = ({
  captureService,
  directoryService,
}: DictionaryPageProps) => {
  const [pathStack, setPathStack] = useState<DirectoryNode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [itemsToDisplay, setItemsToDisplay] = useState<TreeItem[]>([]);

  const currentDir = pathStack[pathStack.length - 1]!;
  const isAtRoot = pathStack.length === 1;

  const navigateInto = (selectedDirNode: DirectoryNode) => {
    setPathStack((prevStack) => [...prevStack, selectedDirNode]);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
  };

  useKeyboard((key) => {
    // how to handle focused logic?
    // if (!focused) return;

    console.log("key.name:", key.name);
    console.log("selectedIndex:", selectedIndex);

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
      const rootNode = await directoryService.getDirectoryTree();
      if (rootNode instanceof Error) {
        console.error("Failed to get directory tree:", rootNode);
        return;
      }

      setPathStack([rootNode]);
    };

    onMount();
  }, [directoryService]);

  useEffect(() => {
    if (!currentDir) return;

    const loadItems = async () => {
      const items: TreeItem[] = [];

      for (const childDir of currentDir.children) {
        items.push({
          type: "dir",
          data: childDir,
          label: ` ${childDir.name}`,
        });
      }

      const captures = await captureService.getCapturesInDirectory(
        currentDir.id
      );
      if (captures instanceof Error) {
        console.error("Failed to get captures in current directory:", captures);
        return;
      }

      for (const capture of captures) {
        items.push({
          type: "capture",
          data: capture,
          label: `${capture.text}`,
        });
      }

      setItemsToDisplay(items);
    };

    loadItems();
  }, [pathStack]);

  return (
    <box flexDirection="column">
      <box
        marginBottom={1}
        paddingX={1}
      >
        <text>
          {pathStack
            .map((node) => {
              if (pathStack.length > 1 && node.name === "/") return;
              return node.name;
            })
            .join("/")}
        </text>
      </box>
      {itemsToDisplay.length > 0 ? (
        <TreeSelect
          height={50}
          focused
          items={itemsToDisplay}
          selectedIndex={selectedIndex}
        />
      ) : (
        <text>Loading or Empty...</text>
      )}
    </box>
  );
};
