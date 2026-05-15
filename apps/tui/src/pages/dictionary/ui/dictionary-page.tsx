import { useDictionary } from "../model/use-dictionary";
import { CreateModal } from "./modals/create-modal";
import { DeleteConfirmModal } from "./modals/delete-confirm-modal";
import { DirectoryTreePane } from "./directory-tree-pane";
import { DefinitionPane } from "./definition-pane";

import type {
  CaptureService,
  DirectoryService,
  DefinitionService,
} from "@dictos/core";

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
      <DirectoryTreePane
        pathStack={pathStack}
        itemsToDisplay={itemsToDisplay}
        focus={focus}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        inputValue={inputValue}
        setInputValue={setInputValue}
      />

      <DefinitionPane
        focus={focus}
        selectedItem={selectedItem}
        definitionsToDisplay={definitionsToDisplay}
        defenitionIndex={defenitionIndex}
        setDefenitionIndex={setDefenitionIndex}
        handleDefinitionSubmit={handleDefinitionSubmit}
      />

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
