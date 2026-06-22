import type { Description, Entry, Folder } from "@dictos/core";

export type ActivePane = "tree" | "description";

export type InteractionAction =
  | "idle"
  | "createInput"
  | "deleteConfirm"
  | "renameInput";

export type TreeItemReference =
  | { type: "entry"; id: string }
  | { type: "folder"; id: string };

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

export type PreviewPaneContent =
  | { kind: "empty" }
  | { kind: "folder"; folderId: string; items: TreeItem[] }
  | { kind: "entry"; entryId: string; descriptions: Description[] };
