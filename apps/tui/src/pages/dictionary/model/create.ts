import { useServices } from "@shared/lib/services";

import { useDictionaryStore, useHelperVariables } from "./use-dictionary-store";

export const useCreateLogic = () => {
  const {
    setDefinitionRefreshTrigger,
    setFocus,
    setInputValue,
    setRefreshTreeItemTrigger,
  } = useDictionaryStore();

  const { captureService, definitionService, directoryService } = useServices();

  const { currentDir, selectedTreeItem } = useHelperVariables();

  const actionRequestCreate = () => {
    setInputValue("");
    setFocus((prev) => ({ ...prev, action: "createInput" }));
  };

  const handleCreateTreeItemSubmit = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setFocus({ pane: "tree", action: "idle" });
      return;
    }

    if (trimmed.endsWith("/")) {
      const name = trimmed.slice(0, -1);
      await directoryService
        .createDirectory({
          name: name,
          parentId: currentDir.id,
        })
        .catch(console.error);
    } else {
      await captureService
        .createCapture({ text: trimmed, directoryId: currentDir.id })
        .catch(console.error);
    }

    setRefreshTreeItemTrigger();
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleCreateDefinitionSubmit = async (finalText: string) => {
    const trimmed = finalText.trim();
    if (!trimmed || !selectedTreeItem) {
      setFocus({ pane: "definition", action: "idle" });
      return;
    }

    await definitionService.createDefinition({
      captureId: selectedTreeItem.data.id,
      text: trimmed,
    });

    setDefinitionRefreshTrigger();
    setFocus({ pane: "definition", action: "idle" });
  };

  return {
    handleCreateTreeItemSubmit,
    handleCreateDefinitionSubmit,
    actionRequestCreate,
  };
};
