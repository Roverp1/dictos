import { ValidationError } from "errors";

export interface Entry {
  id: number;
  text: string;
  folderId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewEntry = Omit<Entry, "id" | "createdAt" | "modifiedAt">;

export function validateNewEntry(data: NewEntry): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Entry cannot be empty." });

  if (data.folderId <= 0 || !Number.isInteger(data.folderId))
    return new ValidationError({ reason: "Invalid folder ID." });
}