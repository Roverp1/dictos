import { ValidationError } from "errors";

export interface Description {
  id: number;
  text: string;
  entryId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewDescription = Omit<Description, "id" | "createdAt" | "modifiedAt">;

export function validateNewDescription(
  data: NewDescription
): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Description text cannot be empty." });

  if (data.entryId <= 0 || !Number.isInteger(data.entryId))
    return new ValidationError({ reason: "Invalid entry ID." });
}