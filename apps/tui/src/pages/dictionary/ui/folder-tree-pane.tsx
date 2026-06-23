import { useDictionary } from "@dictos/react";

import { useTheme } from "@shared/lib/theme";

import { InteractiveList } from "./interactive-list";

export const FolderTreePane = () => {
  const theme = useTheme();

  const { state: st, actions } = useDictionary();

  return (
    <box
      flexDirection="column"
      id="folder-tree-pane"
      border={["right"]}
      borderColor={st.activePane === "tree" ? theme.base0D : theme.base04}
      width="50%"
    >
      <box marginBottom={0}>
        <text fg={theme.base0D}>
          {st.pathStack
            .map((dir) => {
              if (st.pathStack.length > 1 && dir.name === "/") return;
              return dir.name;
            })
            .join("/")}
        </text>
      </box>

      {st.currentFolderItems.length > 0 ? (
        <InteractiveList
          id="tree-item-list"
          flexGrow={1}
          items={st.currentFolderItems}
          focused={st.activePane === "tree"}
          selectedIndex={st.treeCursor}
          renderItem={(item, _, isSelected) => {
            const isRenaming =
              st.interactionAction === "renameInput" &&
              st.activePane === "tree";
            const bgColor = isSelected ? theme.base02 : theme.base00;

            if (isSelected && isRenaming) {
              return (
                <box
                  key={item.id}
                  backgroundColor={bgColor}
                  paddingX={1}
                >
                  <input
                    value={st.inputValue}
                    onChange={actions.general.updateInputValue}
                    // @ts-expect-error opentui type bug
                    onSubmit={actions.tree.submitRename}
                    keyBindings={[
                      { name: "return", action: "submit" },
                      { name: "s", ctrl: true, action: "submit" },
                    ]}
                    focused
                  />
                </box>
              );
            }

            const label =
              item.type === "folder" ? `  ${item.label}` : item.label;

            return (
              <text
                fg={theme.base06}
                bg={bgColor}
              >
                {label}
              </text>
            );
          }}
        />
      ) : (
        <text fg={theme.base05}>
          This folder is empty. Press 'a' to add your first item
        </text>
      )}
    </box>
  );
};
