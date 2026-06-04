import { useServices } from "../../../providers";
import { useDictionaryStore } from "../use-dictionary-store";

export const useDescriptionActions = () => {
  const { descriptionService, logger } = useServices();
  const {
    focus,
    treeItemsToDisplay,
    selectedTreeItemIndex,
    descriptionsToDisplay,
    selectedDescriptionIndex,
    setInputValue,
    setFocus,
    setDescriptionRefreshTrigger,
  } = useDictionaryStore();

  const selectedTreeItem = treeItemsToDisplay[selectedTreeItemIndex];
  const selectedDescription = descriptionsToDisplay[selectedDescriptionIndex];

  return {
    requestCreate: () => {
      setInputValue("");
      setFocus({ pane: "description", action: "createInput" });
    },

    submitCreate: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setFocus({ pane: "description", action: "idle" });
        return;
      }

      if (!selectedTreeItem) {
        logger.error("No entry selected during description creation");
        return;
      }

      await descriptionService.createDescription({
        entryId: selectedTreeItem.data.id,
        text: trimmed,
      });

      setDescriptionRefreshTrigger();
      setFocus({ pane: "description", action: "idle" });
    },

    requestRename: () => {
      if (
        focus.pane === "description" &&
        focus.action === "idle" &&
        descriptionsToDisplay.length > 0
      ) {
        setFocus((prev) => ({ ...prev, action: "renameInput" }));

        if (!selectedDescription) {
          logger.error(
            "No description selected during description rename request"
          );
          return;
        }

        setInputValue(selectedDescription.text);
      }
    },

    submitRename: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setFocus({ pane: "description", action: "idle" });
        return;
      }
      if (!selectedDescription) {
        logger.error(
          "No description selected during description rename submit"
        );
        return;
      }

      const res = await descriptionService.updateDescription(
        selectedDescription.id,
        {
          entryId: selectedDescription.entryId,
          text: trimmed,
        }
      );
      if (res instanceof Error) {
        logger.error("Failed to rename description", res);
      }

      setDescriptionRefreshTrigger();
      setFocus({ pane: "description", action: "idle" });
    },

    requestDelete: () => {
      if (
        focus.pane === "description" &&
        focus.action === "idle" &&
        descriptionsToDisplay.length > 0
      ) {
        setFocus({ pane: "description", action: "deleteConfirm" });
      }
    },

    confirmDelete: async () => {
      if (focus.pane === "description") {
        if (!selectedDescription) {
          logger.error(
            "No description selected during description delete confirm"
          );
          return;
        }
        await descriptionService.deleteDescription(selectedDescription.id);
        setDescriptionRefreshTrigger();
        setFocus({ pane: "description", action: "idle" });
      }
    },
  };
};
