import { useDictionary, type TreeItem } from "@dictos/react";
import { useTheme } from "../../../shared/lib/theme";
import { InteractiveList } from "./interactive-list";
import { SubmitTextarea } from "./submit-textarea";

export const DescriptionPane = () => {
  const theme = useTheme();
  const { state, treeCursorItem, actions } = useDictionary();

  const isEntryMode = state.activeEntryId !== null;
  const isDescriptionFocused = state.activePane === "description";
  let descriptions = state.activeEntryDescriptions;
  if (!isEntryMode) {
    descriptions =
      state.previewPaneContent.kind === "entry"
        ? state.previewPaneContent.descriptions
        : [];
  }

  let folderPreviewItems: TreeItem[] = [];
  if (!isEntryMode && state.previewPaneContent.kind === "folder") {
    folderPreviewItems = state.previewPaneContent.items;
  }

  let title = "";
  if (isEntryMode && treeCursorItem?.type === "entry") {
    title = treeCursorItem.data.text;
  } else if (state.previewPaneContent.kind !== "empty") {
    title = treeCursorItem?.label ?? "";
  }

  if (!isEntryMode && state.previewPaneContent.kind === "empty") {
    return (
      <div
        id="description-pane"
        style={{
          width: "50%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderLeft: `1px solid ${theme.base04}`,
          color: theme.base03,
        }}
      >
        Select an item to view details
      </div>
    );
  }

  return (
    <div
      id="description-pane"
      style={{
        width: "50%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1rem",
        borderLeft: `1px solid ${isDescriptionFocused ? theme.base0D : theme.base04}`,
      }}
    >
      <div
        style={{
          color: isDescriptionFocused ? theme.base0E : theme.base03,
          fontWeight: "bold",
          fontSize: "1.2rem",
        }}
      >
        {title}
      </div>

      {descriptions.length > 0 || isEntryMode ? (
        <InteractiveList
          id="description-list"
          flexGrow={1}
          items={descriptions}
          selectedIndex={isEntryMode ? state.descriptionCursor : -1}
          renderItem={(item, i, isSelected) => {
            const isRenaming =
              isEntryMode &&
              state.interactionAction === "renameInput" &&
              state.activePane === "description";

            if (isSelected && isRenaming) {
              return (
                <div
                  style={{
                    border: `1px solid ${theme.base0D}`,
                    marginBottom: "0.5rem",
                  }}
                >
                  <SubmitTextarea
                    focused={true}
                    onSave={actions.description.submitRename}
                    initialValue={state.inputValue}
                  />
                </div>
              );
            }

            return (
              <div
                style={{
                  border: `1px solid ${isSelected ? theme.base0D : theme.base03}`,
                  padding: "0.5rem",
                  marginBottom: "0.5rem",
                  color: theme.base05,
                  backgroundColor: isSelected ? theme.base02 : "transparent",
                }}
              >
                {item.text}
              </div>
            );
          }}
          ListFooterComponent={
            state.activePane === "description" &&
            state.interactionAction === "createInput" ? (
              <div
                style={{
                  border: `1px solid ${theme.base0B}`,
                  width: "100%",
                }}
              >
                <SubmitTextarea
                  focused={true}
                  onSave={actions.description.submitCreate}
                />
              </div>
            ) : null
          }
        />
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {folderPreviewItems.map((item, i) => (
            <div
              key={i}
              style={{
                color: theme.base05,
                padding: "0.25rem 0.5rem",
              }}
            >
              {item.type === "folder" ? `📁 ${item.label}` : `📄 ${item.label}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
