import type { Capture } from "@models/Capture";
import type { CaptureRepository } from "@ports/out/CaptureRepository";

export class CaptureService {
  constructor(private repo: CaptureRepository) {}

  async createCapture(text: string, directoryId: number): Promise<Capture> {
    if (!text || text.trim().length === 0)
      throw new Error("Validation: text required");

    const toSave = {
      text: text.trim(),
      directoryId,
    };

    const saved = await this.repo.save(toSave);
    return saved;
  }

  async getCapture(id: number): Promise<Capture | null> {
    return this.repo.findById(id);
  }

  async getAll(): Promise<Capture[] | null> {
    return this.repo.getAll();
  }
}
