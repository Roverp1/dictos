import type { TreeItemReference } from "../types";
import { useDictionaryStore } from "../use-dictionary-store";

const isSameTreeItemReference = (a: TreeItemReference, b: TreeItemReference) =>
  a.type === b.type && a.id === b.id;

export const useSelectionActions = () => {
  const st = useDictionaryStore();

  return {
    selectTreeItem: (item: TreeItemReference) => {
      const itemIsSelected = st.selectedTreeItems.some((selectedItem) =>
        isSameTreeItemReference(selectedItem, item)
      );
      if (itemIsSelected) return;

      st.setSelectedTreeItems([...st.selectedTreeItems, item]);
    },

    unselectTreeItem: (item: TreeItemReference) => {
      st.setSelectedTreeItems(
        st.selectedTreeItems.filter(
          (selectedItem) => !isSameTreeItemReference(selectedItem, item)
        )
      );
    },

    toggleTreeItemSelection: (item: TreeItemReference) => {
      const itemIsSelected = st.selectedTreeItems.some((selectedItem) =>
        isSameTreeItemReference(selectedItem, item)
      );

      st.setSelectedTreeItems(
        itemIsSelected
          ? st.selectedTreeItems.filter(
              (selectedItem) => !isSameTreeItemReference(selectedItem, item)
            )
          : [...st.selectedTreeItems, item]
      );
    },

    clearTreeSelection: () => {
      st.setSelectedTreeItems([]);
    },

    openTreeContextMenu: (target: TreeItemReference) => {
      st.setContextMenuTarget(target);
    },

    closeTreeContextMenu: () => {
      st.setContextMenuTarget(null);
    },

    selectDescription: (id: string) => {
      if (st.selectedDescriptionIds.includes(id)) return;

      st.setSelectedDescriptionIds([...st.selectedDescriptionIds, id]);
    },

    unselectDescription: (id: string) => {
      st.setSelectedDescriptionIds(
        st.selectedDescriptionIds.filter((selectedId) => selectedId !== id)
      );
    },

    toggleDescriptionSelection: (id: string) => {
      st.setSelectedDescriptionIds(
        st.selectedDescriptionIds.includes(id)
          ? st.selectedDescriptionIds.filter((selectedId) => selectedId !== id)
          : [...st.selectedDescriptionIds, id]
      );
    },

    clearDescriptionSelection: () => {
      st.setSelectedDescriptionIds([]);
    },

    openDescriptionContextMenu: (id: string) => {
      st.setDescriptionContextMenuTargetId(id);
    },

    closeDescriptionContextMenu: () => {
      st.setDescriptionContextMenuTargetId(null);
    },
  };
};
