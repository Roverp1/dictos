import { ConsolePosition, createCliRenderer, KeyEvent } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import {
  createLibSqlDatabase,
  LibSqlCaptureRepository,
  LibSqlDirectoryRepository,
} from "@dictos/adapters";
import { CaptureService, type Capture } from "@dictos/core";
import { useEffect, useState } from "react";
import { DirectoryService } from "../../../packages/core/src/services/DirectoryService";

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

type FocusMode = "tree" | "modal_add" | "modal_rename";

type TreeItem = {
  type: "dir" | "capture";
  id: number;
  dirId: number;
  label: string;
  rawText: string;
};

function App({ captureService, directoryService }: Props) {
  const renderer = useRenderer();

  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [focusMode, setFocusMode] = useState<FocusMode>("tree");
  const [inputValue, setIntputValue] = useState("");

  const selectedItem = treeItems[selectedIndex] ?? null;

  // data loading
  const loadTree = async () => {
    const dirsResult = await directoryService.getDirectoryTree();
    if (dirsResult instanceof Error) {
      console.error("Failed to load directories:", dirsResult.message);
      return;
    }

    const newTree: TreeItem[] = [];

    for (const dir of dirsResult) {
      newTree.push({
        type: "dir",
        id: dir.id,
        dirId: dir.id,
        label: ` ${dir.name}`,
        rawText: dir.name,
      });

      const capsResult = await captureService.getCapturesInDirectory(dir.id);
      if (capsResult instanceof Error) return;
      for (const cap of capsResult) {
        newTree.push({
          type: "capture",
          id: cap.id,
          dirId: dir.id,
          label: `󰦨 ${cap.text}`,
          rawText: cap.text,
        });
      }
    }

    setTreeItems(newTree);
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, newTree.length - 1)));
  };

  useEffect(() => {
    loadTree();
  }, []);

  // keyboard controls
  useKeyboard((key) => {
    if (key.name === "escape") {
      if (focusMode !== "tree") setFocusMode("tree");
      return;
    }

    if (focusMode === "tree") {
      if (treeItems.length > 0) {
        if (key.name === "j") {
          setSelectedIndex((prev) => Math.min(prev + 1, treeItems.length - 1));
          return;
        }

        if (key.name === "k") {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          return;
        }
      }

      // actions
      if (key.name === "a") {
        setIntputValue("");
        setFocusMode("modal_add");
      }

      if (key.name === "r" && selectedItem) {
        setIntputValue(selectedItem.rawText);
        setFocusMode("modal_rename");
      }

      if (key.name === "d" && selectedItem) {
        handleDelete(selectedItem);
      }
    }
  });

  // actions
  const handleDelete = async (item: TreeItem) => {
    if (item.type === "dir") {
      const res = await directoryService.deleteDirectory(item.id);
      if (res instanceof Error) console.error(res);
    } else {
      const res = await captureService.deleteCapture(item.id);
      if (res instanceof Error) console.error(res);
    }
    await loadTree();
  };

  const handleSubmitAdd = async (submittedValue: string) => {
    const val = submittedValue.trim();
    if (!val) {
      setFocusMode("tree");
      return;
    }

    if (val.endsWith("/")) {
      const name = val.slice(0, -1);
      const res = await directoryService.createDirectory({
        name,
        parentId: null,
        privacy: "private",
      });
      if (res instanceof Error) console.error(res.message);
    } else {
      if (!selectedItem) {
        console.error("Create a directory first!");
      } else {
        const res = await captureService.createCapture({
          text: val,
          directoryId: selectedItem.dirId,
        });
        if (res instanceof Error) console.error(res);
      }
    }

    await loadTree();
    setFocusMode("tree");
  };

  const handleSubmitRename = async (submittedValue: string) => {
    const val = submittedValue.trim();
    if (!val || !selectedItem) {
      setFocusMode("tree");
      return;
    }

    if (selectedItem.type === "dir") {
      const res = await directoryService.renameDirectory(selectedItem.id, val);
      if (res instanceof Error) console.error(res);
    } else {
      const res = await captureService.updateCapture(selectedItem.id, {
        text: val,
      });
      if (res instanceof Error) console.error(res);
    }

    await loadTree();
    setFocusMode("tree");
  };

  const selectOptions = treeItems.map((item, idx) => ({
    name: item.label,
    description: "",
    value: idx.toString(),
  }));

  return (
    <box
      flexDirection="column"
      flexGrow={1}
    >
      <box
        height={1}
        backgroundColor="#D3C6AA"
        paddingX={1}
        marginBottom={1}
      >
        <text fg="#2B3339">/</text>
      </box>

      <box
        flexDirection="row"
        flexGrow={1}
      >
        <box
          width="100%"
          flexDirection="column"
          paddingX={1}
        >
          {treeItems.length > 0 ? (
            <select
              options={selectOptions}
              selectedIndex={selectedIndex}
              onChange={(idx) => setSelectedIndex(idx)}
              focused={focusMode === "tree"}
              height="auto"
              showScrollIndicator
            />
          ) : (
            <text fg="#859289">Empty. Press 'a' and type.</text>
          )}
        </box>
      </box>

      {focusMode !== "tree" && (
        <box
          position="absolute"
          left="20%"
          top="20%"
          width="60%"
          height={5}
          border
          borderColor="#A7C080"
          backgroundColor="#2B3339"
          title={
            focusMode === "modal_add"
              ? "Create (end with '/' for dir):"
              : "Rename:"
          }
          paddingX={1}
          justifyContent="center"
        >
          <input
            value={inputValue}
            onChange={setIntputValue}
            onSubmit={(val) => {
              if (focusMode === "modal_add") handleSubmitAdd(val as string);
              else handleSubmitRename(val as string);
            }}
            focused={true}
            width="100%"
          />
        </box>
      )}
    </box>
  );
}

bootstrap().catch(console.error);
