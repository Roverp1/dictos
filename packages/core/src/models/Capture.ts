import { ValidationError } from "errors";

export interface Capture {
  id: number;
  text: string;
  directoryId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewCapture = Omit<Capture, "id" | "createdAt" | "modifiedAt">;

export function validateNewCapture(data: NewCapture): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Capture cannot be empty." });

  if (data.directoryId <= 0 || !Number.isInteger(data.directoryId))
    return new ValidationError({ reason: "Invalid directory ID." });
}
