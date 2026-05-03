import type { Capture } from "@models/Capture";

export interface CaptureRepository {
  initialize(): Promise<void>;
  save(
    capture: Omit<Capture, "id" | "createdAt" | "modifiedAt">
  ): Promise<Capture>;
  findById(id: number): Promise<Capture | null>;
  getAll(): Promise<Capture[]>;
}
