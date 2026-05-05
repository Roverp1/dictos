import {
  validateNewDirectory,
  type Directory,
  type NewDirectory,
} from "@models/Directory";
import type { DirectoryRepository } from "@ports/outbound";
import { ValidationError, type DbError } from "errors";

export class DirectoryService {
  constructor(private repo: DirectoryRepository) {}

  async createDirectory(
    data: NewDirectory
  ): Promise<Directory | DbError | ValidationError> {
    const errVal = validateNewDirectory(data);
    if (errVal instanceof Error) return errVal;

    const capture = await this.repo.save(data);
    return capture;
  }

  async getDirectoryTree(): Promise<Directory[] | DbError> {
    /* @todo: transform flat list into tree object or smth */
    return await this.repo.findAll();
  }

  async renameDirectory(
    id: number,
    newName: string
  ): Promise<Directory | DbError | ValidationError> {
    if (!newName.trim())
      return new ValidationError({ reason: "Directory name cannot be empty" });

    return await this.repo.update(id, { name: newName });
  }

  async deleteDirectory(id: number): Promise<Directory | DbError> {
    return await this.repo.delete(id);
  }
}
