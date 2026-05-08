import { CaptureService, DirectoryService } from "@dictos/core";

import { TreeSelect } from "./tree-select";
import { useDictionary } from "../model/use-dictionary";

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
    handleCreateSubmit,
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
        <box
          position="absolute"
          left="50%"
          top="12%"
          width="30%"
          height={3}
          border
          borderColor="#57534e"
          title="Create:"
          titleAlignment="left"
        >
          <input
            value={inputValue}
            onChange={setInputValue}
            // @ts-expect-error opentui type collision bug
            onSubmit={handleCreateSubmit}
            focused
          />
        </box>
      )}
    </box>
  );
};
