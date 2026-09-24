import { describe, expect, test } from "bun:test";

import { ValidationError } from "../errors";
import type { Description } from "../models";
import type { DescriptionRepository, SenseRepository } from "../ports/outbound";
import { DescriptionService } from "./description-service";

const now = new Date("2026-01-01T00:00:00.000Z");

function createAssignedDescriptionService() {
  const description: Description = {
    id: "description-1",
    entryId: "entry-1",
    senseId: "sense-1",
    text: "source text",
    type: "misc",
    createdAt: now,
    modifiedAt: now,
  };
  const sense = {
    id: "sense-1",
    entryId: "entry-1",
    name: "same sense",
    createdAt: now,
    modifiedAt: now,
  };
  const descriptions: DescriptionRepository = {
    save: async () => description,
    findById: async () => description,
    findByEntry: async () => [description],
    findBySense: async () => [description],
    update: async (_id, input) => ({
      ...description,
      entryId: input.entryId ?? description.entryId,
      text: input.text ?? description.text,
      type: input.type ?? description.type,
    }),
    assignSense: async () => description,
    delete: async () => description,
  };
  const senses: SenseRepository = {
    save: async () => sense,
    findById: async () => sense,
    findByEntry: async () => [sense],
    update: async () => sense,
    delete: async () => sense,
  };
  return {
    description,
    service: new DescriptionService(descriptions, senses),
  };
}

describe("DescriptionService", () => {
  test("updates an assigned Description when its Entry is unchanged", async () => {
    const { description, service } = createAssignedDescriptionService();

    const result = await service.updateDescription({
      id: description.id,
      entryId: description.entryId,
      text: "renamed text",
    });

    if (result instanceof Error) throw result;
    expect(result).toMatchObject({
      entryId: description.entryId,
      senseId: description.senseId,
      text: "renamed text",
    });
  });

  test("rejects moving an assigned Description to another Entry", async () => {
    const { description, service } = createAssignedDescriptionService();

    const result = await service.updateDescription({
      id: description.id,
      entryId: "entry-2",
    });

    expect(result).toBeInstanceOf(ValidationError);
    if (!(result instanceof ValidationError)) return;
    expect(result.reason).toBe(
      "Detach Description from its Sense before changing its Entry."
    );
  });

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
