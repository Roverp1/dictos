import { toast } from "@opentui-ui/toast";

import { useServices } from "@shared/lib/services";
import { useDictionaryStore } from "@entities/dictionary";

export const useHandleSync = () => {
  const { syncService } = useServices();
  const { setRefreshTreeItemTrigger, setDescriptionRefreshTrigger } =
    useDictionaryStore();

  const handleSync = async () => {
    const toastId = toast.loading("Synchronizing...");

    try {
      const result = await syncService.sync();

      if (result instanceof Error) {
        console.error(result);
        throw result;
      }

      console.log("Sync is successful:", result);

      setRefreshTreeItemTrigger();
      setDescriptionRefreshTrigger();

      toast.success("Synchorization successful!", { id: toastId });
    } catch (err: any) {
      console.error("Sync failed:", err);
      // 6. Update the loading toast to error
      toast.error(err.reason || err.message || "Synchronization failed", {
        id: toastId,
      });
    }
  };

  return { handleSync };
};

// const performSync = async () => {

//   return result;
// };

//   const user = await toast
//     .promise(performSync(), {
//       loading: "Synchronizing...",
//       success: "Synchorization successful!",
//       error: (err: any) =>
//         err.reason || err.message || "Synchronization failed",
//     })
//     ?.unwrap()
//     .catch(() => {});

//   if (user) {
//     setRefreshTreeItemTrigger();
//     setDescriptionRefreshTrigger();
//   }
// };
