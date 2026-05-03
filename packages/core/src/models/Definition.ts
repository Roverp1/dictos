import { ValidationError } from "errors";

export interface Definition {
  id: number;
  text: string;
  captureId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewDefinition = Omit<Definition, "id" | "createdAt" | "modifiedAt">;

export function validateNewDefinition(
  data: NewDefinition
): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Definition text cannot be empty." });

  if (data.captureId <= 0 || !Number.isInteger(data.captureId))
    return new ValidationError({ reason: "Invalid capture ID." });
}
