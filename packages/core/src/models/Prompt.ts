import { ValidationError } from "errors";

export interface Prompt {
  id: number;
  name: string | null;
  text: string;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewPrompt = Omit<Prompt, "id" | "createdAt" | "modifiedAt">;

export function validateNewPrompt(data: NewPrompt): void | ValidationError {
  if (!data.text || data.text.trim() === "")
    return new ValidationError({ reason: "Prompt text cannot be empty." });

  if (data.name !== null && data.name !== undefined && data.name.trim() === "")
    return new ValidationError({
      reason: "Prompt name cannot be empty string if provided.",
    });
}
