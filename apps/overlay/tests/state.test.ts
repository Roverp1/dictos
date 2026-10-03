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
  expect(state.descriptions.some((d: { text: string }) => d.text)).toBe(false);
  state = m.undoDraft(state);
  state = m.receiveGeneration(state, revision, {
    senseName: "a reading measurement",
    descriptions: [{ type: "definition", text: "A measured value." }],
  });
  expect(state.senseName).toBe("reading");
  expect(state.descriptions[0].text).toBe("My edited definition");
  state = m.redoDraft(state);
  expect(state.senseName).toBe("a reading measurement");
  expect(state.descriptions[0].text).toBe("A measured value.");
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
