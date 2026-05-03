export interface Definition {
  id: number;
  text: string;
  captureId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewDefinition = Omit<Definition, "id" | "createdAt" | "modifiedAt">;
