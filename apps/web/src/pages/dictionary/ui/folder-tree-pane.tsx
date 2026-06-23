import { useDictionary } from "@dictos/react";
import { useTheme } from "../../../shared/lib/theme";
import { InteractiveList } from "./interactive-list";
import { useEffect, useRef } from "react";

export const FolderTreePane = () => {
  const theme = useTheme();
  const { state, actions } = useDictionary();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      state.interactionAction === "renameInput" &&
      state.activePane === "tree" &&
      inputRef.current
    ) {
      inputRef.current.focus();
    }
  }, [state.interactionAction, state.activePane]);

  return (
    <div
      id="folder-tree-pane"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${state.activePane === "tree" ? theme.base0D : theme.base04}`,
        width: "50%",
        height: "100%",
        padding: "1rem",
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <span style={{ color: theme.base0D, fontWeight: "bold" }}>
          {state.pathStack
            .map((dir) => {
              if (state.pathStack.length > 1 && dir.name === "/") return "";
              return dir.name;
            })
            .filter(Boolean)
            .join("/") || "/"}
        </span>
      </div>

      {state.currentFolderItems.length > 0 ? (
        <InteractiveList
          id="tree-item-list"
          flexGrow={1}
          items={state.currentFolderItems}
          selectedIndex={state.treeCursor}
          renderItem={(item, _, isSelected) => {
            const isRenaming =
              state.interactionAction === "renameInput" &&
              state.activePane === "tree";
            const bgColor = isSelected ? theme.base02 : "transparent";

            if (isSelected && isRenaming) {
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: bgColor,
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <input
                    ref={inputRef}
                    value={state.inputValue}
                    onChange={(e) =>
                      actions.general.updateInputValue(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        actions.tree.submitRename(state.inputValue);
                      if (e.key === "Escape") actions.general.cancelAction();
                    }}
                    style={{
                      width: "100%",
                      backgroundColor: "transparent",
                      color: theme.base05,
                      border: "none",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              );
            }

            const label =
              item.type === "folder" ? `📁 ${item.label}` : `📄 ${item.label}`;

            return (
              <div
                style={{
                  color: theme.base06,
                  backgroundColor: bgColor,
                  padding: "0.25rem 0.5rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </div>
            );
          }}
        />
      ) : (
        <div style={{ color: theme.base05 }}>
          This folder is empty. Press 'a' to add your first item
        </div>
      )}
    </div>
  );
};
