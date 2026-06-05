import {
  validateNewFolder,
  type Folder,
  type NewFolder,
} from "../models/folder";
import type { FolderRepository } from "../ports/outbound";
import { DbError, ValidationError } from "../errors";

export interface FolderNode extends Folder {
  children: FolderNode[];
}

export class FolderService {
  constructor(private repo: FolderRepository) {}

  async createFolder(
    data: NewFolder
  ): Promise<Folder | DbError | ValidationError> {
    const errVal = validateNewFolder(data);
    if (errVal instanceof Error) return errVal;

    const folder = await this.repo.save(data);
    return folder;
  }

  async getRootFolder(): Promise<Folder | DbError> {
    return await this.repo.findRoot();
  }

  async getSubFolders(parentId: string): Promise<Folder[] | DbError> {
    return await this.repo.findByParentId(parentId);
  }

  async renameFolder(
    id: string,
    newName: string
  ): Promise<Folder | DbError | ValidationError> {
    if (!newName.trim())
      return new ValidationError({ reason: "Folder name cannot be empty" });

    return await this.repo.update(id, { name: newName });
  }

  async deleteFolder(id: string): Promise<Folder | DbError> {
    return await this.repo.delete(id);
  }
}
