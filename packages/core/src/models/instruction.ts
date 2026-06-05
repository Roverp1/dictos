import { ValidationError } from "../errors";

export interface Instruction {
  id: string;
  name: string | null;
  text: string;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewInstruction = Omit<
  Instruction,
  "id" | "createdAt" | "modifiedAt"
>;

export function validateNewInstruction(
  data: NewInstruction
): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Instruction text cannot be empty." });

  if (data.name !== null && data.name !== undefined && data.name.trim() === "")
    return new ValidationError({
      reason: "Instruction name cannot be empty string if provided.",
    });
}
