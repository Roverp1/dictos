export interface Capture {
  id: number;
  text: string;
  directoryId: number;
  createdAt: Date;
  modifiedAt: Date;
}

export type NewCapture = Omit<Capture, "id" | "createdAt" | "modifiedAt">;
