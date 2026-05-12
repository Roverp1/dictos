import {
  CaptureService,
  DirectoryService,
  DefinitionService,
  type Capture,
} from "@dictos/core";

import { InteractiveList } from "./interactive-list";
import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";

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
  const {
    itemsToDisplay,
    definitionsToDisplay,
    selectedIndex,
    setSelectedIndex,
    focusMode,
    setFocusMode,
    inputValue,
    setInputValue,
    pathStack,
    selectedItem,
    handleCreateSubmit,
    handleRenameSubmit,
    handleDeleteConfirmModalConfirm,
    handleDeleteConfirmModalCancel,
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
        width="50%"
      >
        <box marginBottom={1}>
          <text fg="#22c55e">
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
            height={50}
            items={itemsToDisplay}
            focused={focusMode === "tree"}
            selectedIndex={selectedIndex}
            onIndexChange={setSelectedIndex}
            renderItem={(item, i, isSelected) => {
              const isRenaming = focusMode === "renameTreeItem";
              const bgColor = selectedIndex === i ? "#78716c" : "#000";

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

              return <text bg={bgColor}>{item.label}</text>;
            }}
          />
        ) : (
          <text>This directory is emty. Press 'a' to add you first item</text>
        )}
      </box>

      <box
        id="definition-pane"
        width="50%"
        flexDirection="column"
        gap="5%"
      >
        <text>
          {selectedItem?.type === "capture" ? `${selectedItem.data.text}` : ""}
        </text>

        <box
          flexDirection="column"
          gap="3%"
        >
          {definitionsToDisplay.length > 0 ? (
            definitionsToDisplay.map((definition) => (
              <box
                flexDirection="column"
                border
                key={definition.id}
              >
                <text>{definition.text}</text>
              </box>
            ))
          ) : (
            <text>Press 'a' to add first definition for this capture</text>
          )}
        </box>
      </box>

      {focusMode === "createInput" && (
        <CreateModal
          value={inputValue}
          onChange={setInputValue}
          // @ts-expect-error opentui type collision bug
          onSubmit={handleCreateSubmit}
          focused
        />
      )}

      {focusMode === "deleteConfimModal" && (
        <DeleteConfirmModal
          focusMode={focusMode}
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
