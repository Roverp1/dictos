import type { Capture, NewCapture } from "@models/Capture";
import type { DbError } from "errors";

export interface CaptureRepository {
  save(capture: NewCapture): Promise<Capture | DbError>;
  findById(id: number): Promise<Capture | DbError | null>;
  findByDirectory(directoryId: number): Promise<Capture[] | DbError>;
  update(
    id: number,
    data: Partial<Omit<Capture, "id" | "createdAt" | "modifiedAt">>
  ): Promise<Capture | DbError>;
  delete(id: number): Promise<Capture | DbError>;
}
