import {
  validateNewCapture,
  type Capture,
  type NewCapture,
} from "@models/Capture";
import type { CaptureRepository } from "@ports/outbound/CaptureRepository";
import type { DbError, ValidationError } from "errors";

export class CaptureService {
  constructor(private repo: CaptureRepository) {}

  async createCapture(
    data: NewCapture
  ): Promise<Capture | DbError | ValidationError> {
    const valErr = validateNewCapture(data);
    if (valErr instanceof Error) return valErr;

    const capture = await this.repo.save(data);
    return capture;
  }

  async getCaptureById(id: number): Promise<Capture | DbError | null> {
    return await this.repo.findById(id);
  }

  async getCapturesInDirectory(
    directoryId: number
  ): Promise<Capture[] | DbError> {
    return await this.repo.findByDirectory(directoryId);
  }

  async updateCapture(
    id: number,
    data: Partial<NewCapture>
  ): Promise<Capture | DbError> {
    /* @todo: validate data later */
    return await this.repo.update(id, data);
  }

  async deleteCapture(id: number): Promise<Capture | DbError> {
    return await this.repo.delete(id);
  }
}
