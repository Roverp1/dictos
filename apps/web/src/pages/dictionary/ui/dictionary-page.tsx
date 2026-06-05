import { useDictionary } from "@dictos/react";
import { useEffect } from "react";
import { useTheme } from "../../../shared/lib/theme";
import { FolderTreePane } from "./folder-tree-pane";
import { DescriptionPane } from "./description-pane";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";

export const DictionaryPage = () => {
  const theme = useTheme();
  const { state, selectedTreeItem, selectedDescription, actions } = useDictionary();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If we are in an input/textarea, don't trigger global shortcuts
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (state.focus.action !== "idle" && e.key === "Escape") {
        actions.general.cancelAction();
      }

      // Navigation
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        actions.navigation.moveSelectionDown();
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        actions.navigation.moveSelectionUp();
      }
      if (e.key === "Enter" || e.key === "l" || e.key === "ArrowRight") {
        e.preventDefault();
        actions.navigation.navigateIn();
      }
      if (e.key === "Backspace" || e.key === "h" || e.key === "ArrowLeft") {
        e.preventDefault();
        actions.navigation.navigateOut();
      }

      // Actions
      if (state.focus.pane === "tree") {
        if (e.key === "a") {
          e.preventDefault();
          actions.tree.requestCreate();
        }
        if (e.key === "r") {
          e.preventDefault();
          actions.tree.requestRename();
        }
        if (e.key === "d") {
          e.preventDefault();
          actions.tree.requestDelete();
        }
      } else if (state.focus.pane === "description") {
        if (e.key === "a") {
          e.preventDefault();
          actions.description.requestCreate();
        }
        if (e.key === "r") {
          e.preventDefault();
          actions.description.requestRename();
        }
        if (e.key === "d") {
          e.preventDefault();
          actions.description.requestDelete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, actions]);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        backgroundColor: theme.base00,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <FolderTreePane />

      <DescriptionPane />

      {state.focus.pane === "tree" && state.focus.action === "createInput" && (
        <CreateModal
          value={state.inputValue}
          onChange={actions.general.updateInputValue}
          onSubmit={actions.tree.submitCreate}
          focused
        />
      )}

      {state.focus.pane === "tree" && state.focus.action === "deleteConfirm" && (
        <DeleteConfirmModal
          itemName={
            selectedTreeItem?.type === "folder"
              ? `${selectedTreeItem.data.name}/`
              : selectedTreeItem?.data.text
          }
          onConfirm={actions.tree.confirmDelete}
          onCancel={actions.general.cancelAction}
        />
      )}

      {state.focus.pane === "description" && state.focus.action === "deleteConfirm" && (
        <DeleteConfirmModal
          itemName={selectedDescription?.text}
          onConfirm={actions.description.confirmDelete}
          onCancel={actions.general.cancelAction}
        />
      )}
    </div>
  );
};
