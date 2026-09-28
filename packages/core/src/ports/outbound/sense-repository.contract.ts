import { DbError } from "../../errors";
import type { Entry } from "../../models";
import type { ContractCase } from "../../testing/contract-case";
import type { DescriptionRepository } from "./description-repository";
import type { SenseRepository } from "./sense-repository";

export interface SenseRepositoryContractHarness {
  descriptions: DescriptionRepository;
  senses: SenseRepository;
  createEntry(text: string): Promise<Entry>;
  failSenseDelete(): Promise<void>;
}

export const senseRepositoryContract = [
  {
    name: "detaches Descriptions when deleting a Sense without cascade",
    async run(harness) {
      const entry = await harness.createEntry("detach");
      const sense = await harness.senses.save({
        entryId: entry.id,
        name: "detached sense",
      });
      if (sense instanceof Error) throw sense;
      const description = await harness.descriptions.save({
        entryId: entry.id,
        text: "preserved text",
      });
      if (description instanceof Error) throw description;
      const assigned = await harness.descriptions.assignSense({
        descriptionId: description.id,
        senseId: sense.id,
      });
      if (assigned instanceof Error) throw assigned;

      const deleted = await harness.senses.delete({
        id: sense.id,
        cascade: false,
      });
      if (deleted instanceof Error) throw deleted;

      const persistedSense = await harness.senses.findById(sense.id);
      if (persistedSense instanceof Error) throw persistedSense;
      const persistedDescription = await harness.descriptions.findById(
        description.id
      );
      if (persistedDescription instanceof Error) throw persistedDescription;
      if (persistedSense !== null)
        throw new Error("Deleted Sense is still retrievable");
      if (
        persistedDescription === null ||
        persistedDescription.id !== assigned.id ||
        persistedDescription.senseId !== null
      )
        throw new Error("Sense deletion did not detach its Description");
    },
  },
  {
    name: "deletes assigned Descriptions only when cascade is explicit",
    async run(harness) {
      const entry = await harness.createEntry("cascade");
      const sense = await harness.senses.save({
        entryId: entry.id,
        name: "cascaded sense",
      });
      if (sense instanceof Error) throw sense;
      const assignedDescription = await harness.descriptions.save({
        entryId: entry.id,
        text: "delete me",
      });
      if (assignedDescription instanceof Error) throw assignedDescription;
      const preservedDescription = await harness.descriptions.save({
        entryId: entry.id,
        text: "keep me",
      });
      if (preservedDescription instanceof Error) throw preservedDescription;
      const assigned = await harness.descriptions.assignSense({
        descriptionId: assignedDescription.id,
        senseId: sense.id,
      });
      if (assigned instanceof Error) throw assigned;

      const deleted = await harness.senses.delete({
        id: sense.id,
        cascade: true,
      });
      if (deleted instanceof Error) throw deleted;

      const persistedSense = await harness.senses.findById(sense.id);
      if (persistedSense instanceof Error) throw persistedSense;
      const deletedDescription = await harness.descriptions.findById(
        assignedDescription.id
      );
      if (deletedDescription instanceof Error) throw deletedDescription;
      const remainingDescription = await harness.descriptions.findById(
        preservedDescription.id
      );
      if (remainingDescription instanceof Error) throw remainingDescription;
      if (persistedSense !== null)
        throw new Error("Cascaded Sense is still retrievable");
      if (deletedDescription !== null)
        throw new Error("Cascaded Description is still retrievable");
      if (remainingDescription?.id !== preservedDescription.id)
        throw new Error("Cascade deleted an unassigned Description");
    },
  },
  {
    name: "restores cascaded Descriptions when Sense deletion fails",
    async run(harness) {
      const entry = await harness.createEntry("cascade rollback");
      const sense = await harness.senses.save({
        entryId: entry.id,
        name: "rollback sense",
      });
      if (sense instanceof Error) throw sense;
      const description = await harness.descriptions.save({
        entryId: entry.id,
        text: "restore me",
      });
      if (description instanceof Error) throw description;
      const assigned = await harness.descriptions.assignSense({
        descriptionId: description.id,
        senseId: sense.id,
      });
      if (assigned instanceof Error) throw assigned;
      await harness.failSenseDelete();

      const result = await harness.senses.delete({
        id: sense.id,
        cascade: true,
      });

      if (!(result instanceof DbError))
        throw new Error("Failed Sense deletion did not return DbError");
      const persistedSense = await harness.senses.findById(sense.id);
      if (persistedSense instanceof Error) throw persistedSense;
      const persistedDescription = await harness.descriptions.findById(
        description.id
      );
      if (persistedDescription instanceof Error) throw persistedDescription;
      if (persistedSense?.id !== sense.id)
        throw new Error("Failed cascade did not restore the Sense");
      if (
        persistedDescription?.id !== assigned.id ||
        persistedDescription.senseId !== sense.id
      )
        throw new Error("Failed cascade did not restore its Description");
    },
  },
] satisfies readonly ContractCase<SenseRepositoryContractHarness>[];
