import { CaptureService, DirectoryService } from "@dictos/core";

import { TreeSelect } from "./tree-select";
import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";

interface DictionaryPageProps {
  captureService: CaptureService;
  directoryService: DirectoryService;
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
    handleDeleteConfirmModalConfirm,
    handleDeleteConfirmModalCancel,
  } = useDictionary({ captureService, directoryService });

  return (
    <box flexDirection="column">
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
        />
      ) : (
        <text>Loading or Empty...</text>
      )}

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
          itemName={selectedItem?.label}
          onConfirm={handleDeleteConfirmModalConfirm}
          onCancel={handleDeleteConfirmModalCancel}
        />
      )}
    </box>
  );
};
