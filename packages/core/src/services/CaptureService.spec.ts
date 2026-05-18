import { expect, test } from "bun:test";

import type { CaptureRepository } from "@ports/outbound/CaptureRepository";
import type { Capture, NewCapture } from "@models/Capture";
import type { DbError } from "errors";
import { CaptureService } from "./CaptureService";

class MockCaptureRepository {
    storage: Capture[] = [];

    async save(capture: NewCapture): Promise<Capture | DbError> {
        this.storage.push(capture);
    }
    async findById(id: number): Promise<Capture | DbError | null> {
        return this.storage.find((capture) => capture.id == id);
    }
    async findByDirectory(directoryId: number): Promise<Capture[] | DbError> {
        return this.storage.filter((capture) => capture.directoryId === directoryId);
    }
    async update(
        id: number,
        data: Partial<Omit<Capture, "id" | "createdAt" | "modifiedAt">>
    ): Promise<Capture | DbError> {
        const idx = this.storage.findIndex((capture) => capture.id === id);
        if (idx == -1) return;
        this.storage[idx] = data;
        return this.storage[idx];
    }
    async delete(id: number): Promise<Capture | DbError> {
        const idx = this.storage.findIndex((capture) => capture.id === id);
        if (idx == -1) return;
        this.storage.splice(idx, 1);
    }
}

test("CaptureService.createCapture", async () => {
    const capture: Capture = {
        id: 228,
        text: "TEXT",
        directoryId: 676767,
        createdAt: new Date(),
        modifiedAt: new Date(),
    };
    const service = new CaptureService(new MockCaptureRepository());
    service.createCapture(capture);
});

test("CaptureService.getCaptureById", async () => {
    const capture: Capture = {
        id: 228,
        text: "TEXT",
        directoryId: 676767,
        createdAt: new Date(),
        modifiedAt: new Date(),
    };
    const service = new CaptureService(new MockCaptureRepository());
    service.createCapture(capture);
    expect(await service.getCaptureById(228)).toEqual(capture);
});

test("CaptureService.getCapturesInDirectory", async () => {
    const directoryId = 676767;
    const capture1: Capture = {
        id: 228,
        text: "TEXT",
        directoryId: directoryId,
        createdAt: new Date(),
        modifiedAt: new Date(),
    };
    const capture2: Capture = {
        id: 229,
        text: "TEXT :)",
        directoryId: directoryId,
        createdAt: new Date(),
        modifiedAt: new Date(),
    };

    const service = new CaptureService(new MockCaptureRepository());
    service.createCapture(capture1);
    service.createCapture(capture2);

    expect(await service.getCapturesInDirectory(directoryId)).toEqual([capture1, capture2]);
});

test("CaptureService.updateCapture", async () => {
    const capture: Capture = {
        id: 228,
        text: "BALLS",
        directoryId: 676767,
        createdAt: new Date(),
        modifiedAt: new Date(),
    };
    const service = new CaptureService(new MockCaptureRepository());
    service.createCapture(capture);
    capture.text = "NewText";

    expect(await service.updateCapture(capture.id, capture)).toEqual(capture);
});
