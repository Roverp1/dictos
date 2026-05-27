import { validateNewFolder, type Folder, type NewFolder } from "@models/folder";
import type { FolderRepository } from "@ports/outbound";
import { DbError, ValidationError } from "errors";

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

  async getFolderTree(): Promise<FolderNode | DbError> {
    const folders = await this.repo.findAll();
    if (folders instanceof Error) return folders;

    const nodeMap = new Map<number, FolderNode>();
    let rootNode: FolderNode | undefined = undefined;

    for (const folder of folders) {
      const node: FolderNode = {
        ...folder,
        children: [],
      };

      nodeMap.set(folder.id, node);
    }

    for (const folder of folders) {
      if (folder.parentId === null) {
        rootNode = nodeMap.get(folder.id);

        continue;
      }

      const parent = nodeMap.get(folder.parentId);
      const currentNode = nodeMap.get(folder.id);

      if (parent && currentNode) {
        parent.children.push(currentNode);
      }
    }
    if (!rootNode) {
      throw new Error("Root folder not found in the database");
    }

    return rootNode;
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

