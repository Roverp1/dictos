import { expect, test } from "bun:test";
import vm from "node:vm";

async function model() {
  const source = await Bun.file(
    new URL("../qml/state.js", import.meta.url)
  ).text();
  return vm.runInNewContext(
    source +
      "\n({newOverlayState, chooseSense, receiveGeneration, undoDraft, redoDraft, changeText, savePayload, beginGeneration})"
  );
}

test("undo restores edited Descriptions while a late Sense result remains available for redo", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state.senseName = "reading";
  state.descriptions = [
    {
      key: "definition-0",
      type: "definition",
      text: "My edited definition",
      edited: true,
    },
  ];
  state = m.chooseSense(state, "a reading measurement");
  const revision = state.activeGenerationActionRevision;
  expect(state.descriptions[0].text).toBe("My edited definition");
  state = m.undoDraft(state);
  state = m.receiveGeneration(state, revision, {
    senseName: "a reading measurement",
    descriptions: [{ type: "definition", text: "A measured value." }],
  });
  expect(state.senseName).toBe("reading");
  expect(state.descriptions[0].text).toBe("My edited definition");
  state = m.redoDraft(state);
  expect(state.senseName).toBe("a reading measurement");
  expect(state.descriptions.map((d: { text: string }) => d.text)).toEqual([
    "My edited definition",
    "A measured value.",
  ]);
});

test("editing the Entry invalidates a pending reply and center Save excludes right drafts", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state.capturedDescription.text = "I read a book.";
  state = m.beginGeneration(state);
  const revision = state.activeGenerationActionRevision;
  state = m.changeText(state, "entry", "write", false);
  state = m.receiveGeneration(state, revision, {
    senseName: "reading",
    descriptions: [{ type: "definition", text: "Read text." }],
  });
  expect(state.senseName).toBe("");
  state.senseName = "writing";
  state.descriptions[0].text = "Write text.";
  expect(m.savePayload(state, "entry")).toEqual({
    kind: "entry",
    entryText: "write",
    descriptionText: "I read a book.",
  });
  expect(m.savePayload(state, "sense-all")).toEqual({
    kind: "sense",
    entryText: "write",
    descriptionText: "I read a book.",
    includeDescription: true,
    senseName: "writing",
    descriptions: [{ type: "definition", text: "Write text." }],
  });
});

test("redo preserves corrections made after a Sense was generated", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state = m.chooseSense(state, "reading");
  state = m.receiveGeneration(state, state.activeGenerationActionRevision, {
    senseName: "reading",
    descriptions: [{ type: "definition", text: "Generated text" }],
  });
  state = m.changeText(state, "definition-0", "My corrected definition", false);
  state = m.undoDraft(state);
  state = m.redoDraft(state);
  expect(state.descriptions[0].text).toBe("My corrected definition");
});

test("Generate replaces selected Types, preserves unchecked text, and is undoable", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state.senseName = "reading";
  state.descriptions[0].text = "Manual definition";
  state.descriptions[1].text = "Keep this translation";
  state = m.beginGeneration(state);
  expect(state.descriptions[0].text).toBe("");
  expect(state.descriptions[1].text).toBe("Keep this translation");
  state = m.receiveGeneration(state, state.activeGenerationActionRevision, {
    senseName: "reading",
    descriptions: [{ type: "definition", text: "New generated definition" }],
  });
  state = m.undoDraft(state);
  expect(state.descriptions[0].text).toBe("Manual definition");
  state = m.redoDraft(state);
  expect(state.descriptions[0].text).toBe("New generated definition");
});

test("undoing two pending Sense switches retains an inactive cached result for redo", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state = m.chooseSense(state, "B");
  const revision = state.activeGenerationActionRevision;
  state = m.chooseSense(state, "C");
  state = m.receiveGeneration(state, revision, {
    senseName: "B",
    descriptions: [{ type: "definition", text: "Cached B definition" }],
  });
  state = m.undoDraft(state);
  state = m.undoDraft(state);
  state = m.redoDraft(state);
  expect(state.senseName).toBe("B");
  expect(state.descriptions[0].text).toBe("Cached B definition");
});

test("choosing a Sense fills an empty card without deleting a manually added Description", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state.descriptions.push({
    key: "manual-definition",
    type: "definition",
    text: "My manual Description",
    edited: true,
  });
  state = m.chooseSense(state, "reading");
  expect(
    state.descriptions.find(
      (d: { key: string }) => d.key === "manual-definition"
    )?.text
  ).toBe("My manual Description");
  state = m.receiveGeneration(state, state.activeGenerationActionRevision, {
    senseName: "reading",
    descriptions: [{ type: "definition", text: "Generated definition" }],
  });
  expect(
    state.descriptions.find((d: { key: string }) => d.key === "definition-0")
      ?.text
  ).toBe("Generated definition");
  expect(
    state.descriptions.find(
      (d: { key: string }) => d.key === "manual-definition"
    )?.text
  ).toBe("My manual Description");
  expect(state.descriptions.length).toBe(5);
  state = m.undoDraft(state);
  state = m.redoDraft(state);
  expect(
    state.descriptions.find(
      (d: { key: string }) => d.key === "manual-definition"
    )?.text
  ).toBe("My manual Description");
});

test("a Sense switch clears only unedited generated text and keeps every card identity", async () => {
  const m = await model();
  let state = m.newOverlayState();
  state.entry.text = "read";
  state.descriptions[0].text = "Generated for the old Sense";
  state = m.changeText(
    state,
    "translation-0",
    "User corrected translation",
    false
  );
  state.descriptions.push({
    key: "extra-empty",
    type: "definition",
    text: "",
    edited: false,
  });
  state = m.chooseSense(state, "new Sense");
  expect(
    state.descriptions.find((d: { key: string }) => d.key === "definition-0")
      ?.text
  ).toBe("");
  expect(
    state.descriptions.find((d: { key: string }) => d.key === "translation-0")
      ?.text
  ).toBe("User corrected translation");
  expect(state.descriptions.map((d: { key: string }) => d.key)).toEqual([
    "definition-0",
    "translation-0",
    "example-0",
    "misc-0",
    "extra-empty",
  ]);
});
