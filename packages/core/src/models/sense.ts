import { ValidationError } from "../errors";

export interface Sense {
  id: string;
  entryId: string;
  name: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface NewSense {
  entryId: string;
  name: string;
}

export function validateNewSense(data: NewSense): void | ValidationError {
  if (data.name.trim() === "")
    return new ValidationError({ reason: "Sense name cannot be empty." });
}
