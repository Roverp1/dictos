import { useTheme } from "@shared/lib/theme";
import { InteractiveList } from "./interactive-list";

import type { Directory } from "@dictos/core";
import type { FocusState, TreeItem } from "../model/use-dictionary";
import type { Dispatch, SetStateAction } from "react";

type DirectoryTreePaneProps = {
  pathStack: Directory[];
  itemsToDisplay: TreeItem[];
  focus: FocusState;
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  inputValue: string;
  setInputValue: (value: string) => void;
};

export const DirectoryTreePane = ({
  pathStack,
  itemsToDisplay,
  focus,
  selectedIndex,
  setSelectedIndex,
  inputValue,
  setInputValue,
}: DirectoryTreePaneProps) => {
  const theme = useTheme();

  return (
    <box
      flexDirection="column"
      id="directory-tree-pane"
      border={["right"]}
      borderColor={theme.base04}
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

      {itemsToDisplay.length > 0 ? (
        <InteractiveList
          id="tree-item-list"
          flexGrow={1}
          items={itemsToDisplay}
          focused={focus.pane === "tree"}
          selectedIndex={selectedIndex}
          onIndexChange={setSelectedIndex}
          renderItem={(item, i, isSelected) => {
            const isRenaming = focus.action === "renameInput";
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
                    onSubmit={handleRenameSubmit}
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
        <text>This directory is emty. Press 'a' to add you first item</text>
      )}
    </box>
  );
};
