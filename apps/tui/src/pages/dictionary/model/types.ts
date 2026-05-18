import type { Capture, Directory } from "@dictos/core";

type TreeFocus = {
  pane: "tree";
  action: "idle" | "createInput" | "deleteConfirm" | "renameInput";
};

type DefinitionFocus = {
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
