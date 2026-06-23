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
    descriptionContextMenuTargetId,

    setInputValue,
    setActivePane,
    setInteractionAction,
    setDescriptionRefreshTrigger,
    setDescriptionContextMenuTargetId,
  } = useDictionaryStore();

  const descriptionCursorItem = activeEntryDescriptions[descriptionCursor];

  // helpers
  const getSingleDescriptionTarget = () => {
    if (!descriptionContextMenuTargetId) return descriptionCursorItem ?? null;

    return (
      activeEntryDescriptions.find(
        (item) => item.id === descriptionContextMenuTargetId
      ) ?? null
    );
  };

  const finishAction = () => {
    setDescriptionRefreshTrigger();
    setDescriptionContextMenuTargetId(null);
    setActivePane("description");
    setInteractionAction("idle");
  };

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
        logger.error("Failed to create description", res);
        return;
      }

      finishAction();
    },

    requestRename: () => {
      if (
        activePane === "description" &&
        interactionAction === "idle" &&
        activeEntryDescriptions.length > 0
      ) {
        const targetItem = getSingleDescriptionTarget();
        if (!targetItem) {
          logger.error(
            "No description selected during description rename request"
          );
          return;
        }

        setInteractionAction("renameInput");
        setInputValue(targetItem.text);
      }
    },

    submitRename: async (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setActivePane("description");
        setInteractionAction("idle");
        setDescriptionContextMenuTargetId(null);
        return;
      }

      const targetItem = getSingleDescriptionTarget();
      if (!targetItem) {
        logger.error(
          "No description selected during description rename submit"
        );
        return;
      }

      const res = await descriptionService.updateDescription(targetItem.id, {
        entryId: targetItem.entryId,
        text: trimmed,
      });
      if (res instanceof Error) {
        logger.error("Failed to rename description", res);
        return;
      }

      finishAction();
    },

    requestDelete: () => {
      const targetItem = getSingleDescriptionTarget();

      if (
        activePane === "description" &&
        interactionAction === "idle" &&
        targetItem
      ) {
        setInteractionAction("deleteConfirm");
      }
    },

    confirmDelete: async () => {
      if (activePane !== "description") return;

      const targetItem = getSingleDescriptionTarget();
      if (!targetItem) {
        logger.error(
          "No description selected during description delete confirm"
        );
        return;
      }

      const res = await descriptionService.deleteDescription(targetItem.id);
      if (res instanceof Error) {
        logger.error("Failed to delete description", res);
        setInteractionAction("idle");
        return;
      }

      finishAction();
    },
  };
};
