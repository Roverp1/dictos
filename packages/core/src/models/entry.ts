import { ValidationError } from "../errors";

export interface Entry {
  id: string;
  text: string;
  folderId: string;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewEntry = Omit<Entry, "id" | "createdAt" | "modifiedAt">;

export function validateNewEntry(data: NewEntry): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Entry cannot be empty." });
}
