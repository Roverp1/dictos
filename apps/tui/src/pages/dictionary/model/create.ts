import { useServices } from "@shared/lib/services";

import { useDictionaryStore, useHelperVariables } from "./use-dictionary-store";

export const useCreateLogic = () => {
  const {
    setDescriptionRefreshTrigger,
    setFocus,
    setInputValue,
    setRefreshTreeItemTrigger,
  } = useDictionaryStore();

  const { entryService, descriptionService, folderService } = useServices();

  const { currentFolder, selectedTreeItem } = useHelperVariables();

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
      await folderService
        .createFolder({
          name: name,
          parentId: currentFolder.id,
        })
        .catch(console.error);
    } else {
      await entryService
        .createEntry({ text: trimmed, folderId: currentFolder.id })
        .catch(console.error);
    }

    setRefreshTreeItemTrigger();
    setFocus({ pane: "tree", action: "idle" });
  };

  const handleCreateDescriptionSubmit = async (finalText: string) => {
    const trimmed = finalText.trim();
    if (!trimmed || !selectedTreeItem) {
      setFocus({ pane: "description", action: "idle" });
      return;
    }

    await descriptionService.createDescription({
      entryId: selectedTreeItem.data.id,
      text: trimmed,
    });

    setDescriptionRefreshTrigger();
    setFocus({ pane: "description", action: "idle" });
  };

  return {
    handleCreateTreeItemSubmit,
    handleCreateDescriptionSubmit,
    actionRequestCreate,
  };
};