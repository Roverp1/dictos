import { useTheme } from "@shared/lib/theme";

import { InteractiveList } from "./interactive-list";
import { SubmitTextarea } from "./submit-textarea";
import { useDictionary } from "@dictos/react";

export const DescriptionPane = () => {
  const theme = useTheme();

  const { state: st, treeCursorItem, actions } = useDictionary();

  if (!treeCursorItem) return;

  return (
    <box
      id="description-pane"
      width="50%"
      height="100%"
      flexDirection="column"
      gap={1}
      border={["left"]}
      borderColor={
        st.activePane === "description" ? theme.base0D : theme.base04
      }
    >
      <text fg={st.activePane === "description" ? theme.base0E : theme.base03}>
        {treeCursorItem?.type === "entry"
          ? `${treeCursorItem.data.text}`
          : `${treeCursorItem.label}`}
      </text>

      {/* if hovered on word */}
      {treeCursorItem.type === "entry" ? (
        <InteractiveList
          id="description-list"
          contentOptions={{ gap: 1 }}
          flexGrow={1}
          items={st.activeEntryDescriptions}
          focused={st.activePane === "description"}
          selectedIndex={st.descriptionCursor}
          renderItem={(item, i, isSelected) => {
            const isRenaming =
              st.interactionAction === "renameInput" &&
              st.activePane === "description";

            if (isSelected && isRenaming) {
              return (
                <box
                  border
                  borderColor={theme.base0D}
                >
                  <SubmitTextarea
                    focused={true}
                    onSave={actions.description.submitRename}
                    initialValue={st.inputValue}
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
            st.activePane === "description" &&
            st.interactionAction === "createInput" ? (
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
          {st.currentFolderItems.map((item, i) => (
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
