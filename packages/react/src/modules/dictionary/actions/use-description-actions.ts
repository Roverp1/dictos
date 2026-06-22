import { useServices } from "../../../providers";
import { useDictionaryStore } from "../use-dictionary-store";

export const useDescriptionActions = () => {
  const { descriptionService, logger } = useServices();
  const {
    activePane,
    interactionAction,
    descriptionCursor,
    activeEntryDescriptions,
    activeEntryId,

    setInputValue,
    setActivePane,
    setInteractionAction,
    setDescriptionRefreshTrigger,
  } = useDictionaryStore();

  const descriptionCursorItem = activeEntryDescriptions[descriptionCursor];

  return {
    requestCreate: () => {
      setInputValue("");
      setActivePane("description");
      setInteractionAction("createInput");
    },

    submitCreate: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setActivePane("description");
        setInteractionAction("idle");
        return;
      }

      if (!activeEntryId) {
        logger.error("No entry active during description creation");
        return;
      }

      const res = await descriptionService.createDescription({
        entryId: activeEntryId,
        text: trimmed,
      });

      if (res instanceof Error) {
        logger.error("Failed to crete description", res);
        return;
      }

      setDescriptionRefreshTrigger();
      setActivePane("description");
      setInteractionAction("idle");
    },

    requestRename: () => {
      if (
        activePane === "description" &&
        interactionAction === "idle" &&
        activeEntryDescriptions.length > 0
      ) {
        setActivePane("description");
        setInteractionAction("renameInput");

        if (!descriptionCursorItem) {
          logger.error(
            "No description selected during description rename request"
          );
          return;
        }

        setInputValue(descriptionCursorItem.text);
      }
    },

    submitRename: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setActivePane("description");
        setInteractionAction("idle");
        return;
      }
      if (!descriptionCursorItem) {
        logger.error(
          "No description selected during description rename submit"
        );
        return;
      }

      const res = await descriptionService.updateDescription(
        descriptionCursorItem.id,
        {
          entryId: descriptionCursorItem.entryId,
          text: trimmed,
        }
      );
      if (res instanceof Error) {
        logger.error("Failed to rename description", res);
      }

      setDescriptionRefreshTrigger();
      setActivePane("description");
      setInteractionAction("idle");
    },

    requestDelete: () => {
      if (
        activePane === "description" &&
        interactionAction === "idle" &&
        activeEntryDescriptions.length > 0
      ) {
        setActivePane("description");
        setInteractionAction("deleteConfirm");
      }
    },

    confirmDelete: async () => {
      if (activePane === "description") {
        if (!descriptionCursorItem) {
          logger.error(
            "No description selected during description delete confirm"
          );
          return;
        }
        const res = await descriptionService.deleteDescription(
          descriptionCursorItem.id
        );
        if (res instanceof Error) {
          logger.error("Failed to delete description", res);
          setInteractionAction("idle");
          return;
        }

        setDescriptionRefreshTrigger();
        setActivePane("description");
        setInteractionAction("idle");
      }
    },
  };
};
