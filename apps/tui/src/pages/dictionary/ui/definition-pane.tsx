import type { Definition } from "@dictos/core";
import { useTheme } from "@shared/lib/theme";
import type { Dispatch, SetStateAction } from "react";

import { InteractiveList } from "./interactive-list";
import type { FocusState, TreeItem } from "../model/use-dictionary";
import { SubmitTextarea } from "./submit-textarea";

type DefinitionPaneProps = {
  focus: FocusState;
  selectedItem?: TreeItem;
  definitionsToDisplay: Definition[];
  defenitionIndex: number;
  setDefenitionIndex: Dispatch<SetStateAction<number>>;
  handleDefinitionSubmit: (finalText: string) => Promise<void>;
};

export const DefinitionPane = ({
  focus,
  selectedItem,
  definitionsToDisplay,
  defenitionIndex,
  setDefenitionIndex,
  handleDefinitionSubmit,
}: DefinitionPaneProps) => {
  const theme = useTheme();

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
        selectedIndex={defenitionIndex}
        onIndexChange={setDefenitionIndex}
        renderItem={(item, i, isSelected) => {
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
