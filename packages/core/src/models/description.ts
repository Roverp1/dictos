import { ValidationError } from "../errors";

export interface Description {
  id: string;
  text: string;
  entryId: string;
  senseId: string | null;
  type: DescriptionType;
  createdAt: Date;
  modifiedAt: Date;
}

export const descriptionTypes = [
  "misc",
  "translation",
  "definition",
  "example",
] as const;

export type DescriptionType = (typeof descriptionTypes)[number];

export interface NewDescription {
  entryId: string;
  text: string;
  type?: DescriptionType;
}

export function validateNewDescription(
  data: NewDescription
): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Description text cannot be empty." });
}
