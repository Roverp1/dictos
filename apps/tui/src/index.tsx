import { ConsolePosition, createCliRenderer, KeyEvent } from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  createLibSqlDatabase,
  LibSqlCaptureRepository,
  LibSqlDirectoryRepository,
} from "@dictos/adapters";
import { CaptureService, type Capture, type Directory } from "@dictos/core";
import { useEffect, useRef, useState } from "react";
import {
  DirectoryService,
  type DirectoryNode,
} from "../../../packages/core/src/services/DirectoryService";

const bootstrap = async () => {
  const db = await createLibSqlDatabase("file:./dictos.db");

  const captureRepo = new LibSqlCaptureRepository(db);
  const dirRepo = new LibSqlDirectoryRepository(db);

  const captureService = new CaptureService(captureRepo);
  const dirService = new DirectoryService(dirRepo);

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 30,
    },
  });
  createRoot(renderer).render(
    <App
      captureService={captureService}
      directoryService={dirService}
    />
  );
};

interface Props {
  captureService: CaptureService;
  directoryService: DirectoryService;
}

interface TreeItem {
  type: "dir" | "capture";
  data: Directory | Capture;
  label: string;
}

function App({ captureService, directoryService }: Props) {
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
        <select
          height={50}
          focused
          options={itemsToDisplay.map((item, id) => ({
            name: item.label,
            description: "",
            value: id,
          }))}
        />
      ) : (
        <text>Loading or Empty...</text>
      )}
    </box>
  );
}

bootstrap().catch(console.error);
