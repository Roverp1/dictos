export interface Prompt {
  id: number;
  name: string | null;
  text: string;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewPrompt = Omit<Prompt, "id" | "createdAt" | "modifiedAt">;
