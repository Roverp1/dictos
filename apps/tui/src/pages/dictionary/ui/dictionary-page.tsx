import { useEffect, useState } from "react";

import {
  CaptureService,
  DirectoryService,
  type DirectoryNode,
  type Directory,
  type Capture,
} from "@dictos/core";

import { TreeSelect } from "./tree-select";

interface DictionaryPageProps {
  captureService: CaptureService;
  directoryService: DirectoryService;
}

interface TreeItem {
  type: "dir" | "capture";
  data: Directory | Capture;
  label: string;
}

export const DictionaryPage = ({
  captureService,
  directoryService,
}: DictionaryPageProps) => {
  const [pathStack, setPathStack] = useState<DirectoryNode[]>([]);
  const [itemsToDisplay, setItemsToDisplay] = useState<TreeItem[]>([]);

  const currentDir = pathStack[pathStack.length - 1];
  const isAtRoot = pathStack.length === 1;

  const navigateInto = (selectedDirNode: DirectoryNode) => {
    setPathStack((prevStack) => [...prevStack, selectedDirNode]);
  };

  const navigateUp = () => {
    if (isAtRoot) return;

    setPathStack((prevStack) => prevStack.slice(0, -1));
  };

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
        <text>{pathStack.map((node) => node.name).join("/")}</text>
      </box>
      {itemsToDisplay.length > 0 ? (
        <TreeSelect
          height={50}
          focused
          children={itemsToDisplay.map((item, id) => item.label)}
        />
      ) : (
        <text>Loading or Empty...</text>
      )}
    </box>
  );
};
