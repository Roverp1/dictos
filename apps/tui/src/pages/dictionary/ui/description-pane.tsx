import { useTheme } from "@shared/lib/theme";

import { InteractiveList } from "./interactive-list";
import { SubmitTextarea } from "./submit-textarea";
import {
  useDictionaryStore,
  useHelperVariables,
} from "../model/use-dictionary-store";
import { useRenameLogic } from "../model/rename";
import { useCreateLogic } from "../model/create";

export const DescriptionPane = () => {
  const theme = useTheme();

  const {
    inputValue,
    focus,
    descriptionsToDisplay,
    selectedDescriptionIndex,
    setSelectedDescriptionIndex,
    treeItemsOnHoverToDisplay,
  } = useDictionaryStore();

  const { selectedTreeItem } = useHelperVariables();

  const { handleRenameDescriptionSubmit } = useRenameLogic();

  const { handleCreateDescriptionSubmit } = useCreateLogic();

  if (!selectedTreeItem) return;

  return (
    <box
      id="description-pane"
      width="50%"
      height="100%"
      flexDirection="column"
      gap={1}
      border={["left"]}
      borderColor={focus.pane === "description" ? theme.base0D : theme.base04}
    >
      <text fg={focus.pane === "description" ? theme.base0E : theme.base03}>
        {selectedTreeItem?.type === "entry"
          ? `${selectedTreeItem.data.text}`
          : `${selectedTreeItem.label}`}
      </text>

      {/* if hovered on word */}
      {selectedTreeItem.type === "entry" ? (
        <InteractiveList
          id="description-list"
          contentOptions={{ gap: 1 }}
          flexGrow={1}
          items={descriptionsToDisplay}
          focused={focus.pane === "description"}
          focus={focus}
          selectedIndex={selectedDescriptionIndex}
          onIndexChange={setSelectedDescriptionIndex}
          renderItem={(item, i, isSelected) => {
            const isRenaming =
              focus.action === "renameInput" && focus.pane === "description";

            if (isSelected && isRenaming) {
              return (
                <box
                  border
                  borderColor={theme.base0D}
                >
                  <SubmitTextarea
                    focused={true}
                    onSave={handleRenameDescriptionSubmit}
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
            focus.pane === "description" && focus.action === "createInput" ? (
              <box
                border
                borderColor={theme.base0B}
              >
                <SubmitTextarea
                  focused={true}
                  onSave={handleCreateDescriptionSubmit}
                />
              </box>
            ) : null
          }
        />
      ) : (
        // if hovered on folder
        <box>
          {treeItemsOnHoverToDisplay.map((item) => (
            <text fg={theme.base05}>{item.label}</text>
          ))}
        </box>
      )}
    </box>
  );
};
