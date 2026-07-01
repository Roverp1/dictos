import { toast } from "sonner";

import type {
  NotificationOptions,
  NotificationPromiseResult,
  NotificationResult,
  Notifier,
} from "@dictos/react";

const splitContent = (
  content: string | NotificationResult
): [string, NotificationOptions] => {
  if (typeof content === "string") return [content, {}];

  const { message, ...options } = content;
  return [message, options];
};

const resolvePromiseContent = async <T>(
  result: NotificationPromiseResult<T> | undefined,
  value: T,
  fallback: string
): Promise<NotificationResult> => {
  if (!result) return { message: fallback };

  const content = typeof result === "function" ? await result(value) : result;
  if (typeof content === "string") return { message: content };

  return content;
};

export const notifier: Notifier = {
  message(message, options) {
    return toast(message, options);
  },

  success(message, options) {
    return toast.success(message, options);
  },

  info(message, options) {
    return toast.info(message, options);
  },

  warning(message, options) {
    return toast.warning(message, options);
  },

  error(message, options) {
    return toast.error(message, options);
  },

  loading(message, options) {
    return toast.loading(message, options);
  },

  dismiss(id) {
    return toast.dismiss(id);
  },

  async promise(operation, data) {
    const { loading, success, error, finally: onFinally, ...baseOptions } = data;

    const loadingContent = loading
      ? splitContent(loading)
      : (["Loading...", {}] as const);

    const id = toast.loading(loadingContent[0], {
      ...baseOptions,
      ...loadingContent[1],
    });

    const promise =
      typeof operation === "function"
        ? Promise.resolve().then(operation)
        : operation;

    const result = await promise.finally(onFinally);

    if (result instanceof Error) {
      const content = await resolvePromiseContent(error, result, result.message);
      const [message, options] = splitContent(content);

      toast.error(message, {
        ...baseOptions,
        ...options,
        id,
      });

      return result;
    }

    const content = await resolvePromiseContent(success, result, "Done");
    const [message, options] = splitContent(content);

    toast.success(message, {
      ...baseOptions,
      ...options,
      id,
    });

    return result;
  },
};
