import { useTheme } from "@shared/lib/theme";
import { InteractiveList } from "./interactive-list";

import type { Folder } from "@dictos/core";

import { useDictionaryStore } from "../model/use-dictionary-store";

import { useRenameLogic } from "../model/rename";

export const FolderTreePane = () => {
  const theme = useTheme();

  const {
    inputValue,
    setInputValue,
    treeItemsToDisplay,
    focus,
    selectedTreeItemIndex,
    setSelectedTreeItemIndex,
    pathStack,
  } = useDictionaryStore();

  const { handleRenameTreeItemSubmit } = useRenameLogic();

  return (
    <box
      flexDirection="column"
      id="folder-tree-pane"
      border={["right"]}
      borderColor={focus.pane === "tree" ? theme.base0D : theme.base04}
      width="50%"
    >
      <box marginBottom={0}>
        <text fg={theme.base0D}>
          {pathStack
            .map((dir) => {
              if (pathStack.length > 1 && dir.name === "/") return;
              return dir.name;
            })
            .join("/")}
        </text>
      </box>

      {treeItemsToDisplay.length > 0 ? (
        <InteractiveList
          id="tree-item-list"
          flexGrow={1}
          items={treeItemsToDisplay}
          focused={focus.pane === "tree"}
          focus={focus}
          selectedIndex={selectedTreeItemIndex}
          onIndexChange={setSelectedTreeItemIndex}
          renderItem={(item, i, isSelected) => {
            const isRenaming =
              focus.action === "renameInput" && focus.pane === "tree";
            const bgColor = isSelected ? theme.base02 : theme.base00;

            if (isSelected && isRenaming) {
              return (
                <box
                  key={item.id}
                  backgroundColor={bgColor}
                  paddingX={1}
                >
                  <input
                    value={inputValue}
                    onChange={setInputValue}
                    // @ts-expect-error opentui type bug
                    onSubmit={handleRenameTreeItemSubmit}
                    keyBindings={[
                      { name: "return", action: "submit" },
                      { name: "s", ctrl: true, action: "submit" },
                    ]}
                    focused
                  />
                </box>
              );
            }

            return (
              <text
                fg={theme.base06}
                bg={bgColor}
              >
                {item.label}
              </text>
            );
          }}
        />
      ) : (
        <text>This folder is empty. Press 'a' to add your first item</text>
      )}
    </box>
  );
};
