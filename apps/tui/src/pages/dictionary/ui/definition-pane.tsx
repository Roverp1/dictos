import { useTheme } from "@shared/lib/theme";

import { InteractiveList } from "./interactive-list";
import { SubmitTextarea } from "./submit-textarea";
import {
  useDictionaryStore,
  useHelperVariables,
} from "../model/use-dictionary-store";
import { useRenameLogic } from "../model/rename";
import { useCreateLogic } from "../model/create";

export const DefinitionPane = () => {
  const theme = useTheme();

  const {
    inputValue,
    focus,
    definitionsToDisplay,
    selectedDefinitionIndex,
    setSelectedDefinitionIndex,
  } = useDictionaryStore();

  const { selectedTreeItem } = useHelperVariables();

  const { handleRenameDefinitionSubmit } = useRenameLogic();

  const { handleCreateDefinitionSubmit } = useCreateLogic();
  return (
    <box
      id="definition-pane"
      width="50%"
      height="100%"
      flexDirection="column"
      gap={1}
    >
      <text fg={focus.pane === "definition" ? theme.base0E : theme.base03}>
        {selectedTreeItem?.type === "capture"
          ? `${selectedTreeItem.data.text}`
          : ""}
      </text>

      <InteractiveList
        id="definition-list"
        contentOptions={{ gap: 1 }}
        flexGrow={1}
        items={definitionsToDisplay}
        focused={focus.pane === "definition"}
        focus={focus}
        selectedIndex={selectedDefinitionIndex}
        onIndexChange={setSelectedDefinitionIndex}
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
                  onSave={handleRenameDefinitionSubmit}
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
                onSave={handleCreateDefinitionSubmit}
              />
            </box>
          ) : null
        }
      />
      {/* <text>Press 'a' to add first definition for this capture</text> */}
    </box>
  );
};
