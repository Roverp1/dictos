import { DbError, GenerationConflictError } from "../../errors";
import type { DescriptionGenerationProposal, Entry } from "../../models";
import type { ContractCase } from "../../testing/contract-case";
import type { DescriptionGenerationRepository } from "./description-generation-repository";
import type { DescriptionRepository } from "./description-repository";
import type { SenseRepository } from "./sense-repository";

export interface DescriptionGenerationRepositoryContractHarness {
  commits: DescriptionGenerationRepository;
  descriptions: DescriptionRepository;
  senses: SenseRepository;
  createEntry(text: string): Promise<Entry>;
  failDescriptionInsert(): Promise<void>;
}

function newSenseProposal(input: {
  entryId: string;
  sourceDescriptionId: string;
  generatedText: string;
}): DescriptionGenerationProposal {
  return {
    entryId: input.entryId,
    sourceDescriptionId: input.sourceDescriptionId,
    expectedSourceSenseId: null,
    target: {
      kind: "new",
      senseName: "generated sense",
      duplicateCandidateSenseId: null,
    },
    descriptions: [{ type: "definition", text: input.generatedText }],
  };
}

export const descriptionGenerationRepositoryContract = [
  {
    name: "rolls back every write when a generated Description fails to save",
    async run(harness) {
      const entry = await harness.createEntry("rollback");
      const source = await harness.descriptions.save({
        entryId: entry.id,
        text: "source text",
      });
      if (source instanceof Error) throw source;
      const generatedText = "forced Description failure";
      await harness.failDescriptionInsert();

      const result = await harness.commits.commitProposal(
        newSenseProposal({
          entryId: entry.id,
          sourceDescriptionId: source.id,
          generatedText,
        })
      );

      if (!(result instanceof DbError))
        throw new Error("Failed Description insertion did not return DbError");
      const persistedSenses = await harness.senses.findByEntry(entry.id);
      if (persistedSenses instanceof Error) throw persistedSenses;
      const persistedDescriptions = await harness.descriptions.findByEntry(
        entry.id
      );
      if (persistedDescriptions instanceof Error) throw persistedDescriptions;
      if (persistedSenses.length !== 0)
        throw new Error("Failed proposal left a generated Sense behind");
      if (
        persistedDescriptions.length !== 1 ||
        persistedDescriptions[0]?.id !== source.id ||
        persistedDescriptions[0].senseId !== null
      )
        throw new Error(
          "Failed proposal did not restore its source Description"
        );
    },
  },
  {
    name: "rejects a proposal when the source Sense changed",
    async run(harness) {
      const entry = await harness.createEntry("stale source");
      const source = await harness.descriptions.save({
        entryId: entry.id,
        text: "source text",
      });
      if (source instanceof Error) throw source;
      const proposal = newSenseProposal({
        entryId: entry.id,
        sourceDescriptionId: source.id,
        generatedText: "generated definition",
      });
      const assignedSense = await harness.senses.save({
        entryId: entry.id,
        name: "manual sense",
      });
      if (assignedSense instanceof Error) throw assignedSense;
      const assignedSource = await harness.descriptions.assignSense({
        descriptionId: source.id,
        senseId: assignedSense.id,
      });
      if (assignedSource instanceof Error) throw assignedSource;

      const result = await harness.commits.commitProposal(proposal);

      if (!(result instanceof GenerationConflictError))
        throw new Error(
          "Stale source Sense did not cause a generation conflict"
        );
      const persistedSenses = await harness.senses.findByEntry(entry.id);
      if (persistedSenses instanceof Error) throw persistedSenses;
      const persistedDescriptions = await harness.descriptions.findByEntry(
        entry.id
      );
      if (persistedDescriptions instanceof Error) throw persistedDescriptions;
      if (
        persistedSenses.length !== 1 ||
        persistedSenses[0]?.id !== assignedSense.id
      )
        throw new Error("Stale proposal changed the Entry's Senses");
      if (
        persistedDescriptions.length !== 1 ||
        persistedDescriptions[0]?.id !== assignedSource.id ||
        persistedDescriptions[0].senseId !== assignedSense.id
      )
        throw new Error("Stale proposal changed the source Description");
    },
  },
  {
    name: "rejects an existing Sense that differs from the source Sense",
    async run(harness) {
      const entry = await harness.createEntry("wrong target");
      const source = await harness.descriptions.save({
        entryId: entry.id,
        text: "source text",
      });
      if (source instanceof Error) throw source;
      const sourceSense = await harness.senses.save({
        entryId: entry.id,
        name: "source sense",
      });
      if (sourceSense instanceof Error) throw sourceSense;
      const wrongSense = await harness.senses.save({
        entryId: entry.id,
        name: "wrong sense",
      });
      if (wrongSense instanceof Error) throw wrongSense;
      const assignedSource = await harness.descriptions.assignSense({
        descriptionId: source.id,
        senseId: sourceSense.id,
      });
      if (assignedSource instanceof Error) throw assignedSource;
      const proposal: DescriptionGenerationProposal = {
        entryId: entry.id,
        sourceDescriptionId: source.id,
        expectedSourceSenseId: sourceSense.id,
        target: { kind: "existing", senseId: wrongSense.id },
        descriptions: [{ type: "translation", text: "generated translation" }],
      };

      const result = await harness.commits.commitProposal(proposal);

      if (!(result instanceof GenerationConflictError))
        throw new Error("Wrong existing Sense did not cause a conflict");
      const wrongSenseDescriptions = await harness.descriptions.findBySense(
        wrongSense.id
      );
      if (wrongSenseDescriptions instanceof Error) throw wrongSenseDescriptions;
      const persistedSource = await harness.descriptions.findById(source.id);
      if (persistedSource instanceof Error) throw persistedSource;
      if (wrongSenseDescriptions.length !== 0)
        throw new Error("Wrong existing Sense received generated Descriptions");
      if (persistedSource?.senseId !== sourceSense.id)
        throw new Error("Wrong existing Sense changed the source Description");
    },
  },
  {
    name: "rejects a stale expected Sense even when the target matches the source",
    async run(harness) {
      const entry = await harness.createEntry("stale expectation");
      const source = await harness.descriptions.save({
        entryId: entry.id,
        text: "source text",
      });
      if (source instanceof Error) throw source;
      const sourceSense = await harness.senses.save({
        entryId: entry.id,
        name: "current sense",
      });
      if (sourceSense instanceof Error) throw sourceSense;
      const staleExpectedSense = await harness.senses.save({
        entryId: entry.id,
        name: "stale expected sense",
      });
      if (staleExpectedSense instanceof Error) throw staleExpectedSense;
      const assignedSource = await harness.descriptions.assignSense({
        descriptionId: source.id,
        senseId: sourceSense.id,
      });
      if (assignedSource instanceof Error) throw assignedSource;
      const proposal: DescriptionGenerationProposal = {
        entryId: entry.id,
        sourceDescriptionId: source.id,
        expectedSourceSenseId: staleExpectedSense.id,
        target: { kind: "existing", senseId: sourceSense.id },
        descriptions: [{ type: "translation", text: "generated translation" }],
      };

      const result = await harness.commits.commitProposal(proposal);

      if (!(result instanceof GenerationConflictError))
        throw new Error("Stale expected Sense did not cause a conflict");
      const sourceSenseDescriptions = await harness.descriptions.findBySense(
        sourceSense.id
      );
      if (sourceSenseDescriptions instanceof Error)
        throw sourceSenseDescriptions;
      if (
        sourceSenseDescriptions.length !== 1 ||
        sourceSenseDescriptions[0]?.id !== assignedSource.id
      )
        throw new Error("Stale proposal persisted generated Descriptions");
    },
  },
] satisfies readonly ContractCase<DescriptionGenerationRepositoryContractHarness>[];
