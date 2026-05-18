// definitionService.spec.ts
import { expect, test } from "bun:test";
import type { Definition, NewDefinition } from "@models/Definition";
import type { DbError } from "errors";
import { DefinitionService } from "./DefinitionService";

// ------------------------------------------------------------------
// Mock Repository (implements DefinitionRepository)
// ------------------------------------------------------------------
class MockDefinitionRepository {
    storage: Definition[] = [];
    private nextId = 1;

    async save(definition: NewDefinition): Promise<Definition | DbError> {
        const now = new Date();
        const newDef: Definition = {
            ...definition,
            id: this.nextId++,
            createdAt: now,
            modifiedAt: now,
        };
        this.storage.push(newDef);
        return newDef;
    }

    async findByCapture(captureId: number): Promise<Definition[] | DbError> {
        return this.storage.filter(d => d.captureId === captureId);
    }

    async update(
        id: number,
        data: Partial<Omit<Definition, "id" | "createdAt" | "modifiedAt">>
    ): Promise<Definition | DbError> {
        const idx = this.storage.findIndex(d => d.id === id);
        if (idx === -1) {
            return { message: "Definition not found" };
        }
        const updated = {
            ...this.storage[idx],
            ...data,
            modifiedAt: new Date(),
        };
        this.storage[idx] = updated;
        return updated;
    }

    async delete(id: number): Promise<Definition | DbError> {
        const idx = this.storage.findIndex(d => d.id === id);
        if (idx === -1) {
            return { message: "Definition not found" };
        }
        const deleted = this.storage[idx];
        this.storage.splice(idx, 1);
        return deleted;
    }
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

// ✅ Corrected helper – uses "text" instead of "content"
function validNewDef(captureId: number, text: string): NewDefinition {
    return { captureId, text } as NewDefinition;
}

test("DefinitionService.createDefinition", async () => {
    const repo = new MockDefinitionRepository();
    const service = new DefinitionService(repo);
    const input = validNewDef(100, "test definition");

    const result = await service.createDefinition(input);
    expect(result).not.toHaveProperty("message"); // not an error
    expect(result).toMatchObject({
        captureId: 100,
        text: "test definition",
        id: expect.any(Number),
        createdAt: expect.any(Date),
        modifiedAt: expect.any(Date),
    });
});

test("DefinitionService.getDefintionsForCapture", async () => {
    const repo = new MockDefinitionRepository();
    const service = new DefinitionService(repo);

    const def1 = await service.createDefinition(validNewDef(1, "first"));
    const def2 = await service.createDefinition(validNewDef(1, "second"));
    await service.createDefinition(validNewDef(2, "other"));

    const result = await service.getDefintionsForCapture(1);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([def1, def2]));
});

test("DefinitionService.updateDefinition", async () => {
    const repo = new MockDefinitionRepository();
    const service = new DefinitionService(repo);

    const created = await service.createDefinition(validNewDef(5, "old content"));
    if (!created || "message" in created) throw new Error("Creation failed");

    const updated = await service.updateDefinition((created as Definition).id, { text: "new content" });
    expect(updated).toMatchObject({
        id: (created as Definition).id,
        text: "new content",
        captureId: 5,
    });
});

test("DefinitionService.deleteDefinition", async () => {
    const repo = new MockDefinitionRepository();
    const service = new DefinitionService(repo);

    const created = await service.createDefinition(validNewDef(3, "to delete"));
    if (!created || "message" in created) throw new Error("Creation failed");

    const deleted = await service.deleteDefinition((created as Definition).id);
    expect(deleted).toMatchObject({ id: (created as Definition).id, text: "to delete" });

    const after = await service.getDefintionsForCapture(3);
    expect(after).toHaveLength(0);
});
