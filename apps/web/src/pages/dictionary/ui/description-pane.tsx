import { useTheme } from "@shared/lib/theme";

import { InteractiveList } from "./interactive-list";
import { SubmitTextarea } from "./submit-textarea";
import { useDictionary } from "@dictos/react";

export const DescriptionPane = () => {
  const theme = useTheme();

  const { state, selectedTreeItem, actions } = useDictionary();

  if (!selectedTreeItem) return;

  return (
    <box
      id="description-pane"
      width="50%"
      height="100%"
      flexDirection="column"
      gap={1}
      border={["left"]}
      borderColor={
        state.focus.pane === "description" ? theme.base0D : theme.base04
      }
    >
      <text
        fg={state.focus.pane === "description" ? theme.base0E : theme.base03}
      >
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
          items={state.descriptionsToDisplay}
          focused={state.focus.pane === "description"}
          selectedIndex={state.selectedDescriptionIndex}
          renderItem={(item, i, isSelected) => {
            const isRenaming =
              state.focus.action === "renameInput" &&
              state.focus.pane === "description";

            if (isSelected && isRenaming) {
              return (
                <box
                  border
                  borderColor={theme.base0D}
                >
                  <SubmitTextarea
                    focused={true}
                    onSave={actions.description.submitRename}
                    initialValue={state.inputValue}
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
            state.focus.pane === "description" &&
            state.focus.action === "createInput" ? (
              <box
                border
                borderColor={theme.base0B}
              >
                <SubmitTextarea
                  focused={true}
                  onSave={actions.description.submitCreate}
                />
              </box>
            ) : null
          }
        />
      ) : (
        // if hovered on folder
        <box>
          {state.treeItemsOnHoverToDisplay.map((item, i) => (
            <text
              fg={theme.base05}
              key={i}
            >
              {item.label}
            </text>
          ))}
        </box>
      )}
    </box>
  );
};
