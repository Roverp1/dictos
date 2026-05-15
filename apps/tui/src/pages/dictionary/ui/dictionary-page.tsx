import {
  CaptureService,
  DirectoryService,
  DefinitionService,
} from "@dictos/core";
import { useRef } from "react";

import { InteractiveList } from "./interactive-list";
import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { useTheme } from "@shared/lib/theme";
import type { ScrollBoxRenderable } from "@opentui/core";
import { SubmitTextarea } from "./submit-textarea";

interface DictionaryPageProps {
  captureService: CaptureService;
  directoryService: DirectoryService;
  definitionService: DefinitionService;
}

export const DictionaryPage = ({
  captureService,
  directoryService,
  definitionService,
}: DictionaryPageProps) => {
  const theme = useTheme();

  const {
    itemsToDisplay,
    selectedIndex,
    setSelectedIndex,
    definitionsToDisplay,
    defenitionIndex,
    setDefenitionIndex,
    focus,
    setFocus,
    inputValue,
    setInputValue,
    pathStack,
    selectedItem,
    handleCreateSubmit,
    handleRenameSubmit,
    handleDeleteConfirmModalConfirm,
    handleDeleteConfirmModalCancel,
    handleDefinitionSubmit,
  } = useDictionary({ captureService, directoryService, definitionService });

  return (
    <box
      height="100%"
      flexDirection="row"
    >
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

      {focus.pane === "tree" && focus.action === "createInput" && (
        <CreateModal
          value={inputValue}
          onChange={setInputValue}
          // @ts-expect-error opentui type collision bug
          onSubmit={handleCreateSubmit}
          focused
        />
      )}

      {focus.action === "deleteConfirm" && (
        <DeleteConfirmModal
          focus={focus}
          itemName={
            selectedItem?.type === "dir"
              ? `${selectedItem.data.name}/`
              : selectedItem?.data.text
          }
          onConfirm={handleDeleteConfirmModalConfirm}
          onCancel={handleDeleteConfirmModalCancel}
        />
      )}
    </box>
  );
};
