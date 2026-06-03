import { ValidationError } from "errors";

export interface Description {
  id: string;
  text: string;
  entryId: string;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewDescription = Omit<
  Description,
  "id" | "createdAt" | "modifiedAt"
>;

export function validateNewDescription(
  data: NewDescription
): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Description text cannot be empty." });
}

