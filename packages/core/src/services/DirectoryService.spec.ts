// directoryService.spec.ts
import { expect, test } from "bun:test";
import type { Directory, NewDirectory } from "@models/Directory";
import type { DbError } from "errors";
import { DirectoryService, type DirectoryNode } from "./DirectoryService";

// ------------------------------------------------------------------
// Mock Repository (implements DirectoryRepository)
// ------------------------------------------------------------------
class MockDirectoryRepository {
    storage: Directory[] = [];
    private nextId = 1;

    async save(directory: NewDirectory): Promise<Directory | DbError> {
        const now = new Date();
        const newDir: Directory = {
            name: directory.name,
            parentId: directory.parentId ?? null,
            privacy: directory.privacy ?? "private", // default privacy
            id: this.nextId++,
            createdAt: now,
            modifiedAt: now,
        };
        this.storage.push(newDir);
        return newDir;
    }

    async findRoot(): Promise<Directory | DbError> {
        const root = this.storage.find(d => d.parentId === null);
        if (!root) return { message: "Root directory not found" };
        return root;
    }

    async findById(id: number): Promise<Directory | DbError | null> {
        return this.storage.find(d => d.id === id) || null;
    }

    async findAll(): Promise<Directory[] | DbError> {
        return [...this.storage];
    }

    async findByParentId(parentId: number): Promise<Directory[] | DbError> {
        return this.storage.filter(d => d.parentId === parentId);
    }

    async update(
        id: number,
        data: Partial<Omit<Directory, "id" | "createdAt" | "modifiedAt">>
    ): Promise<Directory | DbError> {
        const idx = this.storage.findIndex(d => d.id === id);
        if (idx === -1) return { message: "Directory not found" };
        const updated = {
            ...this.storage[idx],
            ...data,
            modifiedAt: new Date(),
        };
        this.storage[idx] = updated;
        return updated;
    }

    async delete(id: number): Promise<Directory | DbError> {
        const idx = this.storage.findIndex(d => d.id === id);
        if (idx === -1) return { message: "Directory not found" };
        const deleted = this.storage[idx];
        this.storage.splice(idx, 1);
        return deleted;
    }
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

function validNewDir(name: string, parentId?: number | null, privacy?: "private" | "public" | "unlisted"): NewDirectory {
    return { name, parentId: parentId ?? undefined, privacy };
}

test("DirectoryService.createDirectory", async () => {
    const repo = new MockDirectoryRepository();
    const service = new DirectoryService(repo);
    const input = validNewDir("My Folder", null, "public");

    const result = await service.createDirectory(input);
    expect(result).not.toHaveProperty("message");
    expect(result).toMatchObject({
        name: "My Folder",
        parentId: null,
        privacy: "public",
        id: expect.any(Number),
        createdAt: expect.any(Date),
        modifiedAt: expect.any(Date),
    });
});

test("DirectoryService.getRootDirectory", async () => {
    const repo = new MockDirectoryRepository();
    const service = new DirectoryService(repo);

    const root = await service.createDirectory(validNewDir("Root", null));
    await service.createDirectory(validNewDir("Child", (root as Directory).id));

    const foundRoot = await service.getRootDirectory();
    expect(foundRoot).toMatchObject({ id: (root as Directory).id, name: "Root", parentId: null });
});

test("DirectoryService.getSubDirectories", async () => {
    const repo = new MockDirectoryRepository();
    const service = new DirectoryService(repo);

    const parent = await service.createDirectory(validNewDir("Parent", null));
    const child1 = await service.createDirectory(validNewDir("Child1", (parent as Directory).id));
    const child2 = await service.createDirectory(validNewDir("Child2", (parent as Directory).id));

    const subs = await service.getSubDirectories((parent as Directory).id);
    expect(subs).toHaveLength(2);
    expect(subs).toEqual(expect.arrayContaining([child1, child2]));
});

test("DirectoryService.getDirectoryTree", async () => {
    const repo = new MockDirectoryRepository();
    const service = new DirectoryService(repo);

    // Create root
    const root = await service.createDirectory(validNewDir("Root", null));
    // Create children
    const childA = await service.createDirectory(validNewDir("A", (root as Directory).id));
    const childB = await service.createDirectory(validNewDir("B", (root as Directory).id));
    // Grandchild
    await service.createDirectory(validNewDir("A1", (childA as Directory).id));

    const tree = await service.getDirectoryTree() as DirectoryNode;
    expect(tree.id).toBe((root as Directory).id);
    expect(tree.children).toHaveLength(2);
    const childANode = tree.children.find(c => c.id === (childA as Directory).id);
    expect(childANode?.children).toHaveLength(1);
});

test("DirectoryService.renameDirectory", async () => {
    const repo = new MockDirectoryRepository();
    const service = new DirectoryService(repo);

    const dir = await service.createDirectory(validNewDir("OldName", null));
    const updated = await service.renameDirectory((dir as Directory).id, "NewName");
    expect(updated).toMatchObject({ id: (dir as Directory).id, name: "NewName" });
});

test("DirectoryService.deleteDirectory", async () => {
    const repo = new MockDirectoryRepository();
    const service = new DirectoryService(repo);

    const dir = await service.createDirectory(validNewDir("ToDelete", null));
    const deleted = await service.deleteDirectory((dir as Directory).id);
    expect(deleted).toMatchObject({ id: (dir as Directory).id, name: "ToDelete" });

    const all = await service.getSubDirectories(-1); // any query that would include it
    // Actually we can check repo directly
    expect(repo.storage.find(d => d.id === (dir as Directory).id)).toBeUndefined();
});
