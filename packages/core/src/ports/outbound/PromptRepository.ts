import type { NewPrompt, Prompt } from "@models/Prompt";
import type { DbError } from "errors";

export interface PromptRepository {
  save(prompt: NewPrompt): Promise<Prompt | DbError>;
  findById(id: number): Promise<DbError | Prompt | null>;
  findAll(): Promise<Prompt[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Prompt, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Prompt | DbError>;
  delete(id: number): Promise<Prompt | DbError>;
}
