import type { Entry, Folder } from "@dictos/core";

type TreeFocus = {
  pane: "tree";
  action: "idle" | "createInput" | "deleteConfirm" | "renameInput";
};

type DescriptionFocus = {
  pane: "description";
  action: "idle" | "createInput" | "deleteConfirm" | "renameInput";
};

export type FocusState = TreeFocus | DescriptionFocus;

interface FolderTreeItem {
  /** format: "folder-${dbId}" */
  id: string;
  type: "folder";
  data: Folder;
  label: string;
}

interface EntryTreeItem {
  /** format: "entry-${dbId}" */
  id: string;
  type: "entry";
  data: Entry;
  label: string;
}

export type TreeItem = FolderTreeItem | EntryTreeItem;