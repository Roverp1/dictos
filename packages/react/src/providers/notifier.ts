export type NotificationId = string | number;

export type NotificationVariant =
  | "message"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationOptions {
  id?: NotificationId;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  closeButton?: boolean;
  action?: NotificationAction;
}

export interface NotificationResult extends NotificationOptions {
  message: string;
}

export type NotificationPromiseResult<T = unknown> =
  | string
  | NotificationResult
  | ((
      data: T
    ) => string | NotificationResult | Promise<string | NotificationResult>);

export interface NotificationPromiseData<
  T = unknown,
  E extends Error = Error,
> extends NotificationOptions {
  loading?: string | NotificationResult;
  success?: NotificationPromiseResult<T>;
  error?: NotificationPromiseResult<E>;
  finally?: () => void | Promise<void>;
}

export interface Notifier {
  message(message: string, options?: NotificationOptions): NotificationId;
  success(message: string, options?: NotificationOptions): NotificationId;
  info(message: string, options?: NotificationOptions): NotificationId;
  warning(message: string, options?: NotificationOptions): NotificationId;
  error(message: string, options?: NotificationOptions): NotificationId;
  loading(message: string, options?: NotificationOptions): NotificationId;
  dismiss(id?: NotificationId): NotificationId | undefined;

  /**
   * Expects operations to resolve with either a value or an Error
   * Rejections are expected to be handled at their boundary
   */
  promise<T, E extends Error = Error>(
    operation: Promise<T | E> | (() => Promise<T | E>),
    data: NotificationPromiseData<T, E>
  ): Promise<T | E>;
}
