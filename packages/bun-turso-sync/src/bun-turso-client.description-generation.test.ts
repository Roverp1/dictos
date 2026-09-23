import { afterEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DbError,
  DescriptionService,
  GenerationConflictError,
  SenseService,
  ValidationError,
  type DescriptionGenerationProposal,
} from "@dictos/core";
import {
  SqliteDescriptionGenerationRepository,
  SqliteDescriptionRepository,
  SqliteEntryRepository,
  SqliteFolderRepository,
  SqliteSenseRepository,
} from "@dictos/db-core";
import type { Logger } from "@dictos/logger";
import { sql } from "drizzle-orm";

import { BunTursoClient } from "./bun-turso-client";

const testLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => testLogger,
};

const cleanups = new Set<() => Promise<void>>();

async function createFixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-description-generation-")
  );
  const client = await BunTursoClient.create(
    path.join(directory, "dictos.db"),
    testLogger
  );
  const folders = new SqliteFolderRepository(client.db);
  const root = await folders.findRoot();
  if (root instanceof Error) throw root;
  const entries = new SqliteEntryRepository(client.db, crypto.randomUUID());
  const descriptions = new SqliteDescriptionRepository(client.db);
  const senses = new SqliteSenseRepository(client.db);
  const commits = new SqliteDescriptionGenerationRepository(client.db);
  cleanups.add(async () => {
    const closed = await client.close();
    if (closed instanceof Error) throw closed;
    await fs.rm(directory, { recursive: true, force: true });
  });

  return {
    client,
    commits,
    descriptions,
    descriptionService: new DescriptionService(descriptions, senses),
    entries,
    root,
    senses,
    senseService: new SenseService(senses),
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function saveEntry(fixture: Fixture, text: string) {
  const entry = await fixture.entries.save({
    folderId: fixture.root.id,
    text,
  });
  if (entry instanceof Error) throw entry;
  return entry;
}

async function saveDescription(
  fixture: Fixture,
  entryId: string,
  text: string
) {
  const description = await fixture.descriptions.save({ entryId, text });
  if (description instanceof Error) throw description;
  return description;
}

async function saveSense(fixture: Fixture, entryId: string, name: string) {
  const sense = await fixture.senses.save({ entryId, name });
  if (sense instanceof Error) throw sense;
  return sense;
}

function newSenseProposal(input: {
  entryId: string;
  sourceDescriptionId: string;
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
    descriptions: [{ type: "definition", text: "generated definition" }],
  };
}

afterEach(async () => {
  const pendingCleanups = [...cleanups];
  cleanups.clear();
  for (const cleanup of pendingCleanups) await cleanup();
});

describe("Description Generation persistence", () => {
  test("rolls back every write when generated Description insertion fails", async () => {
    const fixture = await createFixture();
    const entry = await saveEntry(fixture, "hello");
    const source = await saveDescription(fixture, entry.id, "source text");
    await fixture.client.db.run(
      sql.raw(`
      CREATE TRIGGER fail_generated_description
      BEFORE INSERT ON descriptions
      FOR EACH ROW WHEN NEW.text = 'generated definition'
      BEGIN
        SELECT RAISE(ABORT, 'forced generated Description failure');
      END
    `)
    );

    const result = await fixture.commits.commitProposal(
      newSenseProposal({
        entryId: entry.id,
        sourceDescriptionId: source.id,
      })
    );

    expect(result).toBeInstanceOf(DbError);
    const persistedSenses = await fixture.senses.findByEntry(entry.id);
    if (persistedSenses instanceof Error) throw persistedSenses;
    const persistedDescriptions = await fixture.descriptions.findByEntry(
      entry.id
    );
    if (persistedDescriptions instanceof Error) throw persistedDescriptions;
    expect(persistedSenses).toEqual([]);
    expect(persistedDescriptions).toEqual([source]);
  });

  test("rejects a proposal when the source Sense changed", async () => {
    const fixture = await createFixture();
    const entry = await saveEntry(fixture, "stale");
    const source = await saveDescription(fixture, entry.id, "source text");
    const proposal = newSenseProposal({
      entryId: entry.id,
      sourceDescriptionId: source.id,
    });
    const assignedSense = await saveSense(fixture, entry.id, "manual sense");
    const assignedSource = await fixture.descriptions.assignSense({
      descriptionId: source.id,
      senseId: assignedSense.id,
    });
    if (assignedSource instanceof Error) throw assignedSource;

    const result = await fixture.commits.commitProposal(proposal);

    expect(result).toBeInstanceOf(GenerationConflictError);
    const persistedSenses = await fixture.senses.findByEntry(entry.id);
    if (persistedSenses instanceof Error) throw persistedSenses;
    const persistedDescriptions = await fixture.descriptions.findByEntry(
      entry.id
    );
    if (persistedDescriptions instanceof Error) throw persistedDescriptions;
    expect(persistedSenses).toEqual([assignedSense]);
    expect(persistedDescriptions).toEqual([assignedSource]);
  });

  test("rejects an existing-Sense target that differs from the source Sense", async () => {
    const fixture = await createFixture();
    const entry = await saveEntry(fixture, "wrong target");
    const source = await saveDescription(fixture, entry.id, "source text");
    const sourceSense = await saveSense(fixture, entry.id, "source sense");
    const wrongSense = await saveSense(fixture, entry.id, "wrong sense");
    const assignedSource = await fixture.descriptions.assignSense({
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

    const result = await fixture.commits.commitProposal(proposal);

    expect(result).toBeInstanceOf(GenerationConflictError);
    const wrongSenseDescriptions = await fixture.descriptions.findBySense(
      wrongSense.id
    );
    if (wrongSenseDescriptions instanceof Error) throw wrongSenseDescriptions;
    const persistedSource = await fixture.descriptions.findById(source.id);
    if (persistedSource instanceof Error) throw persistedSource;
    expect(wrongSenseDescriptions).toEqual([]);
    expect(persistedSource).toEqual(assignedSource);
  });

  test("detaches Descriptions when deleting a Sense by default", async () => {
    const fixture = await createFixture();
    const entry = await saveEntry(fixture, "detach");
    const sense = await saveSense(fixture, entry.id, "detached sense");
    const description = await saveDescription(
      fixture,
      entry.id,
      "preserved text"
    );
    const assigned = await fixture.descriptions.assignSense({
      descriptionId: description.id,
      senseId: sense.id,
    });
    if (assigned instanceof Error) throw assigned;

    const deleted = await fixture.senseService.deleteSense({ id: sense.id });
    if (deleted instanceof Error) throw deleted;

    const persistedSense = await fixture.senses.findById(sense.id);
    if (persistedSense instanceof Error) throw persistedSense;
    const persistedDescription = await fixture.descriptions.findById(
      description.id
    );
    if (persistedDescription instanceof Error) throw persistedDescription;
    expect(persistedSense).toBeNull();
    expect(persistedDescription).toMatchObject({
      id: assigned.id,
      entryId: assigned.entryId,
      senseId: null,
      text: assigned.text,
      type: assigned.type,
    });
  });

  test("deletes assigned Descriptions only when Sense cascade is explicit", async () => {
    const fixture = await createFixture();
    const entry = await saveEntry(fixture, "cascade");
    const sense = await saveSense(fixture, entry.id, "cascaded sense");
    const assignedDescription = await saveDescription(
      fixture,
      entry.id,
      "delete me"
    );
    const preservedDescription = await saveDescription(
      fixture,
      entry.id,
      "keep me"
    );
    const assigned = await fixture.descriptions.assignSense({
      descriptionId: assignedDescription.id,
      senseId: sense.id,
    });
    if (assigned instanceof Error) throw assigned;

    const deleted = await fixture.senseService.deleteSense({
      id: sense.id,
      cascade: true,
    });
    if (deleted instanceof Error) throw deleted;

    const persistedSense = await fixture.senses.findById(sense.id);
    if (persistedSense instanceof Error) throw persistedSense;
    const deletedDescription = await fixture.descriptions.findById(
      assignedDescription.id
    );
    if (deletedDescription instanceof Error) throw deletedDescription;
    const remainingDescription = await fixture.descriptions.findById(
      preservedDescription.id
    );
    if (remainingDescription instanceof Error) throw remainingDescription;
    expect(persistedSense).toBeNull();
    expect(deletedDescription).toBeNull();
    expect(remainingDescription).toEqual(preservedDescription);
  });

  test("rejects assigning a Description to another Entry's Sense", async () => {
    const fixture = await createFixture();
    const firstEntry = await saveEntry(fixture, "first entry");
    const secondEntry = await saveEntry(fixture, "second entry");
    const description = await saveDescription(
      fixture,
      firstEntry.id,
      "first description"
    );
    const otherSense = await saveSense(fixture, secondEntry.id, "second sense");

    const result = await fixture.descriptionService.assignToSense({
      descriptionId: description.id,
      senseId: otherSense.id,
    });

    expect(result).toBeInstanceOf(ValidationError);
    const persistedDescription = await fixture.descriptions.findById(
      description.id
    );
    if (persistedDescription instanceof Error) throw persistedDescription;
    expect(persistedDescription).toEqual(description);
  });
});
