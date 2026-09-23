import { describe, expect, test } from "bun:test";

import { ValidationError } from "../errors";
import type { Description } from "../models";
import type { DescriptionRepository, SenseRepository } from "../ports/outbound";
import { DescriptionService } from "./description-service";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("DescriptionService", () => {
  test("rejects assigning a Description to another Entry's Sense", async () => {
    const description = {
      id: "description-1",
      entryId: "entry-1",
      senseId: null,
      text: "source text",
      type: "misc" as const,
      createdAt: now,
      modifiedAt: now,
    };
    const otherSense = {
      id: "sense-2",
      entryId: "entry-2",
      name: "other sense",
      createdAt: now,
      modifiedAt: now,
    };
    let persistedDescription: Description = description;
    const descriptions: DescriptionRepository = {
      save: async () => persistedDescription,
      findById: async (id) =>
        id === persistedDescription.id ? persistedDescription : null,
      findByEntry: async () => [persistedDescription],
      findBySense: async () => [],
      update: async () => persistedDescription,
      assignSense: async ({ senseId }) => {
        persistedDescription = { ...persistedDescription, senseId };
        return persistedDescription;
      },
      delete: async () => persistedDescription,
    };
    const senses: SenseRepository = {
      save: async () => otherSense,
      findById: async (id) => (id === otherSense.id ? otherSense : null),
      findByEntry: async () => [otherSense],
      update: async () => otherSense,
      delete: async () => otherSense,
    };
    const service = new DescriptionService(descriptions, senses);

    const result = await service.assignToSense({
      descriptionId: description.id,
      senseId: otherSense.id,
    });

    expect(result).toBeInstanceOf(ValidationError);
    if (!(result instanceof ValidationError)) return;
    expect(result.reason).toBe(
      "Description and Sense must belong to the same Entry."
    );
    expect(await service.getDescriptionById(description.id)).toEqual(
      description
    );
  });
});
