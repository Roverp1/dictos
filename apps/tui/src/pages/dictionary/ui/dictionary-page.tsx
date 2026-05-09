import {
  CaptureService,
  DirectoryService,
  DefinitionService,
} from "@dictos/core";

import { TreeSelect } from "./tree-select";
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
}: DictionaryPageProps) => {
  const {
    itemsToDisplay,
    focusMode,
    inputValue,
    setInputValue,
    pathStack,
    selectedIndex,
    selectedItem,
    handleCreateSubmit,
    handleRenameSubmit,
    handleDeleteConfirmModalConfirm,
    handleDeleteConfirmModalCancel,
  } = useDictionary({ captureService, directoryService });

  return (
    <box flexDirection="row">
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
          <TreeSelect
            height={50}
            focused={focusMode === "tree"}
            items={itemsToDisplay}
            selectedIndex={selectedIndex}
            isRenaming={focusMode === "renameTreeItem"}
            renameValue={inputValue}
            onRenameChange={setInputValue}
            onRenameSubmit={handleRenameSubmit}
          />
        ) : (
          <text>This directory is emty. Press 'a' to add you first item</text>
        )}
      </box>

      <box
        id="definitions-pane"
        width="50%"
      ></box>

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
