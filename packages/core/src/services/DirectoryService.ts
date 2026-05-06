import {
  validateNewDirectory,
  type Directory,
  type NewDirectory,
} from "@models/Directory";
import type { DirectoryRepository } from "@ports/outbound";
import { DbError, ValidationError } from "errors";

export interface DirectoryNode extends Directory {
  children: DirectoryNode[];
}

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

  async getDirectoryTree(): Promise<DirectoryNode | DbError> {
    const dirs = await this.repo.findAll();
    if (dirs instanceof Error) return dirs;

    const nodeMap = new Map<number, DirectoryNode>();
    let rootNode: DirectoryNode | undefined = undefined;

    for (const dir of dirs) {
      const node: DirectoryNode = {
        ...dir,
        children: [],
      };

      nodeMap.set(dir.id, node);
    }

    for (const dir of dirs) {
      if (dir.parentId === null) {
        rootNode = nodeMap.get(dir.id);

        continue;
      }

      const parent = nodeMap.get(dir.parentId);
      const currentNode = nodeMap.get(dir.id);

      if (parent && currentNode) {
        parent.children.push(currentNode);
      }
    }
    if (!rootNode) {
      throw new Error("Root directory not found in the database");
    }

    return rootNode;
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
