import type { Definition } from "@dictos/core";
import { useTheme } from "@shared/lib/theme";
import type { Dispatch, SetStateAction } from "react";

import { InteractiveList } from "./interactive-list";
import type { FocusState, TreeItem } from "../model/use-dictionary";
import { SubmitTextarea } from "./submit-textarea";
import { useDictionaryStore } from "../model/use-dictionary-store";

type DefinitionPaneProps = {
  focus: FocusState;
  selectedItem?: TreeItem;
  definitionsToDisplay: Definition[];
  definitionIndex: number;
  setDefinitionIndex: Dispatch<SetStateAction<number>>;
  handleDefinitionSubmit: (finalText: string) => Promise<void>;
  handleRenameDefinition: (value: string) => Promise<void>;
};

export const DefinitionPane = ({
  focus,
  selectedItem,
  definitionsToDisplay,
  definitionIndex,
  setDefinitionIndex,
  handleDefinitionSubmit,
  handleRenameDefinition,
}: DefinitionPaneProps) => {
  const theme = useTheme();

  const { setInputValue, inputValue } = useDictionaryStore();

  return (
    <box
      id="definition-pane"
      width="50%"
      height="100%"
      flexDirection="column"
      gap={1}
    >
      <text fg={focus.pane === "definition" ? theme.base0E : theme.base03}>
        {selectedItem?.type === "capture" ? `${selectedItem.data.text}` : ""}
      </text>

      <InteractiveList
        id="definition-list"
        contentOptions={{ gap: 1 }}
        flexGrow={1}
        items={definitionsToDisplay}
        focused={focus.pane === "definition"}
        focus={focus}
        selectedIndex={definitionIndex}
        onIndexChange={setDefinitionIndex}
        renderItem={(item, i, isSelected) => {
          const isRenaming =
            focus.action === "renameInput" && focus.pane === "definition";

          if (isSelected && isRenaming) {
            return (
              <box
                border
                borderColor={theme.base0D}
              >
                <SubmitTextarea
                  focused={true}
                  onSave={handleRenameDefinition}
                  initialValue={inputValue}
                />
              </box>
            );
          }

          return (
            <box
              border
              borderColor={isSelected ? theme.base0D : theme.base03}
            >
              <text fg={theme.base05}>{item.text}</text>
            </box>
          );
        }}
        ListFooterComponent={
          focus.pane === "definition" && focus.action === "createInput" ? (
            <box
              border
              borderColor={theme.base0B}
            >
              <SubmitTextarea
                focused={true}
                onSave={handleDefinitionSubmit}
              />
            </box>
          ) : null
        }
      />
      {/* <text>Press 'a' to add first definition for this capture</text> */}
    </box>
  );
};
